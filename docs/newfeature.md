# Shopping List + House Calendar — Design Doc (v1.2)

Companion to CLAUDE.md and docs/telegram.md. Drop in the repo (e.g.
`docs/shopping-calendar.md`). Assumes the Telegram integration
(`lib/telegram.ts` with `notifyHouse()`, `/api/digest` evening cron, linked
group chat) exists — build that first if it doesn't yet.

Both features follow every existing invariant: `requireMember(slug)` gating,
houseId-scoped queries, server actions with `{ error }` returns,
`force-dynamic` pages, `revalidatePath` after mutations, design tokens from
`tailwind.config.ts`.

---

# Feature 1 — Shared Shopping List

## Problem

Housemates double-buy shared supplies (toiletries, cleaning materials) because
there's no shared view of what's needed vs already bought.

## Behavior

- Any member adds items to one house-wide list.
- Any member ticks an item off once bought. Bought items **stay visible**,
  struck-through/dimmed, in a "Bought" section below the open items — the
  visible history is the point (todo-list style, per owner).
- Ticking is reversible (mis-taps happen): untick returns it to the open list.
- A "Clear bought" button archives everything in the Bought section so the
  list doesn't grow forever. Archive = soft delete; don't hard-delete rows.
- Telegram: the group is notified on add and on bought. **Bought is the
  critical notification** — it's what prevents the double-buy.

## Data model

```
shopping_items
  id            serial PK
  house_id      FK houses (cascade)
  name          text            -- "Dish soap"
  note          text nullable   -- "the lemon one", brand, size
  added_by      FK members
  bought_by     FK members, nullable
  bought_at     timestamp, nullable    -- null = still needed
  archived_at   timestamp, nullable    -- set by "Clear bought"
  created_at    timestamp
```

Status is derived, never stored as an enum: open = `bought_at IS NULL`,
bought = `bought_at NOT NULL AND archived_at IS NULL`, archived = hidden.
Untick = null out `bought_at`/`bought_by`. Same derive-don't-store philosophy
as balances.

## UI

- `/h/[slug]/app/shopping` — link from the dashboard header/nav alongside
  "Recurring bills".
- Single quick-add input at top (name + optional note), open items list, then
  dimmed "Bought" section with who bought each and when, "Clear bought" at the
  bottom. Tick/untick via checkbox, no page navigation.
- Show open-item count on the dashboard link (e.g. "Shopping (3)") so an
  outstanding list is visible without visiting the page.

## Telegram

```
🛒 Mei added <b>Dish soap</b> (the lemon one)
✅ Jon bought <b>Dish soap</b> — no need to buy it
```

- Per-item messages in v1. Known risk: adding many items at once spams the
  group. Accept for now; if it annoys the house, the fix is a short debounce
  window that batches adds by the same member into one message ("Mei added 6
  items: …"). Note the decision, don't build batching preemptively.
- No notification on untick or archive (noise, no action needed by others).

## Optional stretch (only if it stays small)

"Log as expense" link on a bought item that opens the existing expense form
prefilled with the item name. **Do not** auto-create expenses from ticks — not
every shopping item has a known price at tick time, and silent money mutations
violate the app's auditability principle.

## Out of scope

Assignees, quantities, price tracking, multiple lists, item categories.

---

# Feature 2 — House Calendar / Reminders

## Problem

Shared obligations get forgotten: pay rent to the landlord monthly, aircon
servicing every ~4 months, house dinners and other one-off events.

## ⚠️ Sharp edge: rent *reminder* ≠ rent *auto-post*

`recurring_templates` already auto-posts the rent **expense** (the ledger
entry splitting cost between members). This feature is about **doing things in
the real world** — actually transferring rent to the landlord, booking the
servicing. Keep the two systems fully separate:

- Do NOT merge house_events with recurring_templates or add reminder logic to
  the expense-posting cron path. They share a "monthly recurrence" shape but
  have different lifecycles (events can be one-off, every-4-months, edited per
  occurrence) and different failure impact (a wrong ledger entry is money; a
  wrong reminder is a message).
- It's fine — expected, even — that the house has both a "Rent" recurring
  template (posts the expense on the 1st) and a "Pay landlord" event
  (reminds on the 30th/31st).

## Data model

```
house_events
  id             serial PK
  house_id       FK houses (cascade)
  title          text
  note           text nullable
  next_date      date            -- next occurrence (SGT semantics)
  recurrence     jsonb           -- see below
  remind_days_before  integer default 1
  active         integer default 1
  last_reminded_on    text nullable  -- "YYYY-MM-DD" idempotency, same pattern
                                     -- as last_posted_month / last_digest_date
  created_by     FK members
  created_at     timestamp
```

`recurrence` jsonb, deliberately minimal (NOT full rrule):

```ts
type Recurrence =
  | { freq: "none" }                       // one-off (dinner)
  | { freq: "monthly"; day: number }       // pay rent, day 1–31 (clamp short months)
  | { freq: "months"; interval: number }   // aircon every 4 months, anchored on next_date
  | { freq: "yearly" };
```

Why this shape: the app already has proven month-clamping logic
(`daysInMonth`, `min(day, dim)`) — reuse it. Full rrule/weekly/weekday support
is speculative; every real use case named so far (rent, aircon every 4 months,
dinners) fits the four variants. Extend only when a real need appears.

**Advancing:** when an occurrence's date passes, compute the next `next_date`
from the recurrence and update the row; `freq: "none"` events deactivate
instead. Do this in the daily scan (below), not at reminder time — reminder
(days before) and roll-over (day after) are different moments.

## Reminder delivery — cron budget constraint

Vercel Hobby's cron allowance is small and both slots are likely used
(`/api/cron` 00:05 SGT for bill posting, `/api/digest` 19:00 SGT). **Do not
add a third cron.** Fold the event scan into the `/api/digest` route's daily
run (it already runs daily and only *sends the digest* on Sundays — the event
scan runs every day):

Per active event, with `sgToday()`:
1. If `today == next_date - remind_days_before` and `last_reminded_on != today`
   → send reminder, set `last_reminded_on`.
2. If `remind_days_before > 0` and `today == next_date` and
   `last_reminded_on != today` → send a day-of message too, set
   `last_reminded_on`. (If `remind_days_before == 0`, step 1 already covers
   day-of.)
3. If `today > next_date` → advance `next_date` per recurrence, or set
   `active = 0` for one-offs.

All idempotent — a rerun the same day sends nothing twice.

## UI

- `/h/[slug]/app/events` — upcoming events sorted by `next_date`; add/edit
  form: title, note, date, recurrence picker (Once / Monthly on day N / Every
  N months / Yearly), remind-days-before, active toggle. Model the pages on
  the existing `recurring/` trio (list, new, [id]) — same conventions, same
  form patterns.
- Dashboard: small "Upcoming" strip with the next 2–3 events (title + date),
  linking to the events page. Keeps important dates visible without opening
  anything.

## Telegram

```
📅 Alex added <b>House dinner</b> — Sat 8 Aug
⏰ Tomorrow: <b>Pay landlord</b> (rent S$3,200)     ← remind_days_before
⏰ Today: <b>Aircon servicing</b> — every 4 months  ← day-of
```

Notify on event creation and on reminders. No notification for edits or for
routine `next_date` roll-over (noise).

## Out of scope

RSVPs/attendance, per-member reminders or DMs, times-of-day (dates only in
v1 — "dinner at 8pm" goes in the title/note), Google Calendar sync, weekly
recurrence.

---

# Shared notes for the implementing session

- **Schema workflow:** edit `schema.ts` → `npm run db:generate` → commit
  `drizzle/` → `db:migrate` prod → deploy. One migration covering both tables
  is fine.
- **Bot command menu:** after adding any new bot commands (e.g. `/shopping` to
  print the open list — cheap and useful), re-send the full command list to
  @BotFather via `/setcommands` (it overwrites).
- **Digest additions:** the weekly digest may optionally append open shopping
  items and the next upcoming events — 2 lines each, only if non-empty. Nice
  cohesion win, trivial once both features exist.
- **Testing checklist:**
  - [ ] Add item → group message; tick → "no need to buy" message; untick →
        silent; Clear bought → items disappear from UI but rows remain
        (archived_at set).
  - [ ] Monthly event on day 31 reminds correctly in a 30-day month (clamp).
  - [ ] Every-4-months event advances `next_date` by exactly 4 months after
        passing.
  - [ ] One-off event deactivates after its date; no further messages.
  - [ ] Curl `/api/digest` twice same day → no duplicate reminders.
  - [ ] Telegram down / token wrong → all mutations still succeed.