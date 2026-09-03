# CLAUDE.md — Housemate Ledger

Context handoff for Claude Code. This file captures what the project is, every
decision made so far, and — most importantly — *why*, so you can extend the code
without re-litigating settled questions or breaking invariants.

## What this is

A private web app for one household (4 housemates in a shared HDB flat in
Singapore) to track shared expenses, split bills Splitwise-style, and settle up.
The owner (Tim) is a software engineer; treat him as a technical peer.

**Access model is the defining product choice:** it works like when2meet. A house
lives at an unguessable URL (`/h/<12-char-slug>`); anyone who opens the link
types a username (optionally sets a password to lock that name) and is in. No
emails, no signup, no OAuth. This was chosen deliberately over account-based
auth to remove all onboarding friction for a small trusted group.

A full PRD exists (v1.0, approved) — summary of its resolved decisions:

| Decision | Choice | Why |
|---|---|---|
| Rent split | Adjustment (equal base + fixed S$ top-ups per room) | Rooms differ in size; owner picked adjustment over shares |
| House access | Unguessable link only, no house password | Trusted household; friction beats marginal security here |
| Recurring bills | Auto-post on schedule (no confirm step), editable after | Zero-touch rent; variable utilities get edited after the real bill arrives |
| Edit permissions | Any member can edit/delete any expense | Full-trust household; change trail (created_by / updated_by) kept for transparency |
| Notifications | None in v1 (Telegram deferred to v1.1) | Scope control |
| Currency | SGD only | Single household in Singapore |
| Money movement | Out of scope — app records settlements, PayNow happens outside | Recording ≠ executing; keeps app trivial and safe |

## Status

- **Done:** M1 (house link + login/session), M2 (expense CRUD, all 5 split
  methods with live preview, balances + debt simplification), M3-partial
  (settle-up + activity feed shipped early because balances are useless without
  them), M4 (recurring bills + cron auto-posting), v1.1 Telegram integration
  (see `docs/telegram.md` for the design doc — activity notifications, weekly
  digest, `/link` `/unlink` `/balances` `/summary` webhook commands).
  **Digest cadence decision:** weekly only, every Sunday evening SGT — the
  doc offered a weekly+monthly-section option too, but that needed prior-month
  aggregation the doc didn't fully specify, so the simpler fallback it
  suggested was chosen instead. Every digest always shows month-to-date spend.
  **Edit/delete notifications:** the doc's original call was expense created +
  settlement only, deliberately excluding edits/deletes as noise — but it
  flagged "revisit only if the house asks," and the owner asked, so
  `saveExpense`'s edit branch and `deleteExpense` now also `notifyHouse()`
  (✏️/🗑️ prefixed). Every expense notification (create/edit) includes a
  per-person "X owes $Y" breakdown, not just the payer/category/split-method
  line the doc sketched.
- **Shared shopping list** (see `docs/newfeature.md`, Feature 1). Any member
  adds items (name + optional note); any member ticks one bought. Bought items
  stay visible, dimmed, below the open list — that visible history is the
  point. Untick is silent (no notification); "Clear bought" soft-deletes (sets
  `archived_at`) rather than hard-deleting rows. Telegram notifies on add and
  on bought (bought is the important one — it's what prevents the double-buy);
  the `/shopping` webhook command prints the open list on demand. The weekly
  digest appends an open-shopping-items line when the list is non-empty.
- **House calendar / reminders** (`docs/newfeature.md`, Feature 2). Deliberately
  separate system from `recurring_templates` — see Invariant 11. Any member
  creates an event: title, optional note, next date, recurrence (`Once` /
  `Monthly on day N` / `Every N months` / `Yearly`), remind-days-before, active
  toggle. The daily scan (`runEventScan()` in `lib/events.ts`) is folded into
  `/api/digest` (which already runs daily; it only *sends the digest* on
  Sundays) rather than adding a third Vercel cron slot — see the doc's "cron
  budget constraint." Telegram notifies on event creation and on reminders
  only; edits, deletes, and routine `next_date` roll-over are silent (noise).
  The weekly digest appends a next-3-events line when any are active.
  **Calendar scope expansion (post-`docs/newfeature.md`):** the owner later
  approved adding optional start/end time-of-day per event and replacing the
  flat list with Month/Week calendar-grid views (Google-Calendar-style),
  deliberately beyond `docs/newfeature.md`'s stated v1 scope (which excluded
  times-of-day and calendar sync — `docs/newfeature.md` is left as-is, a
  historical record, not edited). Occurrences of recurring events are
  projected in-memory for display (`projectOccurrences` in `lib/events.ts`,
  grid/layout math in `lib/calendar-grid.ts`) and never persisted —
  `next_date`/`last_reminded_on`/`runEventScan()` are completely unchanged.
  See Invariant 12. No calendar sync (Google/iCal import/export) was added;
  still out of scope.
- **Bottom navigation (persistent tab bar)** replaced the dashboard's "Go to"
  tile grid with a 5-tab bar (Home/Shopping/Calendar/Activity/More) that
  stays visible across every browse/list page (hidden on create/edit forms).
  Recurring bills, Members, and Telegram — the destinations that don't fit
  the primary bar — moved to a new `/app/more` landing page. **Known
  trade-off:** the old dashboard grid's Shopping tile showed an open-item
  count badge; the new Shopping tab has no equivalent badge, so that
  glanceable "don't double-buy" signal is gone until you open the Shopping
  tab. Accepted deliberately rather than plumbing a count into the nav bar
  (would require crossing the server/client boundary non-trivially) — revisit
  if the household finds this a real gap in practice.
- **Deployed and in use** on Vercel + Supabase by the owner.
- **Not built yet (M5):** CSV export, monthly summary view, filters
  (month/category/person). Also v1.1 ideas still open: receipt photo upload,
  spend charts, saved split presets, link regeneration + house password (the
  planned response if the house link ever leaks), and the "log shopping item
  as expense" stretch goal from `docs/newfeature.md`.

## Stack & why

- **Next.js 14 App Router + TypeScript**, server actions for all mutations (no
  separate API layer to maintain; forms work without client JS where possible).
- **Tailwind CSS**, hand-rolled components — shadcn/ui was considered and
  skipped to keep the dependency surface tiny for an app this size.
- **`lucide-react`** for icons (bottom nav tabs only) — small, tree-shaken,
  zero transitive dependencies (one peer dep on React, already satisfied).
  The one exception to the "hand-rolled components, minimal dependencies"
  stance above; icons were judged not worth hand-rolling for a 5-icon bar.
- **Drizzle ORM + `postgres` driver** against **Supabase Postgres (free tier)**.
- **Supabase is used ONLY as a Postgres host.** Supabase Auth and RLS are
  deliberately unused — the when2meet access model doesn't fit email-based auth
  providers. Do not "improve" this by adding Supabase Auth; it would break the
  core product decision. All access control is app-level, scoped by the
  session's houseId in server actions/guards.
- **Custom sessions:** `jose`-signed JWT in an httpOnly cookie (`hf_session`),
  90-day expiry. `bcryptjs` for optional per-member passwords. `SESSION_SECRET`
  env var signs cookies.
- **Vercel Hobby** hosting; **Vercel Cron** (daily) for recurring bills. Hobby
  plan allows daily crons — that constraint shaped the design (one daily
  catch-up run rather than precise per-template scheduling).
- Fonts (Space Grotesk display / Inter body) load via a Google Fonts `<link>`
  in `layout.tsx`, NOT `next/font` — next/font downloads at build time, which
  fails in sandboxed/offline builds. A build-time warning about
  fonts.googleapis.com minification is harmless; browsers load fonts at runtime.

## Code map

```
src/
  db/schema.ts        houses, members, expenses, expense_shares,
                      settlements, recurring_templates, shopping_items, house_events
  db/index.ts         lazy db() singleton — see "Invariants"
  lib/split.ts        SplitConfig type + resolveShares() — the money math
  lib/balances.ts     computeNet() + simplify() (greedy debt simplification)
  lib/session.ts      create/get/clear signed session cookie
  lib/guard.ts        requireMember(slug) — auth gate for every app page/action
  lib/recurring.ts    sgToday(), sgIsSunday(), daysInMonth(), postTemplate(), runDueTemplates()
  lib/telegram.ts     sendMessage/notifyHouse/escapeHtml + message renderers (the only
                      module that talks to the Telegram API)
  lib/digest.ts       buildBalancesMessage/buildDigestMessage — shared by the weekly
                      cron and the /balances,/summary webhook commands
  lib/events.ts       Recurrence type, advanceNextDate(), describeRecurrence(),
                      formatEventDate(), formatEventTime(), projectOccurrences()
                      (pure, derives calendar-grid occurrences — see Invariant 12),
                      runEventScan() (house_events only — kept fully separate
                      from lib/recurring.ts, see Invariant 11)
  lib/date-strings.ts parseDate/fmtDate/addDays — zero-dependency Y-M-D string math,
                      the one shared implementation lib/events.ts and
                      lib/calendar-grid.ts both build on
  lib/calendar-grid.ts getMonthGridDates(), getWeekDates(), layoutDayTimedBlocks()
                      — pure month/week grid + timed-block layout math, no DB,
                      no knowledge of house_events; safe to import from client
                      components (unlike lib/events.ts)
  lib/constants.ts    categories, member color palette, fmtSGD()
  app/page.tsx        landing: create house
  app/actions.ts      createHouse (nanoid 12-char slug, ambiguous chars excluded)
  app/h/[slug]/       login page + loginOrJoin/logout actions
  app/h/[slug]/app/layout.tsx  shared layout rendering the persistent bottom nav
                      (components/BottomNav.tsx: Home/Shopping/Calendar/Activity/More,
                      lucide-react icons) on an exact-path allowlist of 8 browse/list
                      routes — hidden on every create/edit form page
  app/h/[slug]/app/   dashboard (balances receipt, settle suggestions, most-recent-8
                      activity feed with a "See all" link to activity/)
    actions.ts        saveExpense / deleteExpense / settleUp / quickSettle
                      (create-expense, settleUp, quickSettle also notifyHouse())
    activity/         full expense+settlement history, "Load more" paginated
                      (activity-feed-list.tsx, client) in lib/activity.ts's
                      ACTIVITY_PAGE_SIZE (20) increments via loadMoreActivity —
                      re-fetches all house expenses/settlements and re-slices
                      the merged feed by offset each call rather than a DB-level
                      cursor (cheap at household scale, same "fetch everything,
                      derive in memory" approach as balances, Invariant 4;
                      avoids cursor logic across two unioned tables ordered by
                      (date, id) desc). Reuses lib/activity.ts's buildFeed() and
                      components/ActivityFeed.tsx, the same feed merge/render
                      the dashboard uses for its capped preview, so the two
                      never drift out of sync
    expenses/         expense-form.tsx (client, live preview) + new/edit pages
    recurring/        template list/new/edit + saveTemplate/deleteTemplate/postNow
                      (postTemplate in lib/recurring.ts also notifyHouse())
    telegram/         link/unlink UI — generateLinkCode/disconnectTelegram actions
    members/          member list + edit UI — saveMember (username/color/password)
                      and toggleMemberActive (soft-delete via active flag) actions
    shopping/         list/add/tick UI — addItem/buyItem/untickItem/clearBought actions
                      (addItem, buyItem also notifyHouse())
    more/             landing page for Recurring/Members/Telegram — the 3
                      destinations that don't fit the primary 5-tab nav bar,
                      reusing components/NavTile.tsx in the same grid pattern
                      the dashboard used to render before this moved here
    events/           Month/Week calendar-grid UI (calendar-view.tsx client shell,
                      month-grid.tsx, week-grid.tsx) + new/edit form (event-form.tsx,
                      with an all-day toggle and optional start/end time) —
                      saveEvent/deleteEvent/getCalendarData actions (saveEvent's
                      create branch also notifyHouse(); edits are silent).
                      calendar-data.ts holds buildCalendarData(), the shared
                      fetch-all-events-and-project-occurrences helper used by
                      both the page's initial server render and getCalendarData
                      (client-side prev/next/today/view-toggle navigation)
  app/api/cron/       GET, Bearer CRON_SECRET, calls runDueTemplates()
  app/api/digest/     GET, Bearer CRON_SECRET, calls runEventScan() every run (daily),
                      weekly (Sunday SGT) digest send per linked house
  app/api/telegram/   POST webhook, verifies X-Telegram-Bot-Api-Secret-Token, handles
                      /link /unlink /balances /summary /shopping
docs/telegram.md      Telegram integration design doc (decisions + rationale)
docs/newfeature.md    Shopping list + house calendar design doc (both features built)
drizzle/              generated SQL migrations (drizzle-kit generate)
vercel.json           crons: "5 16 * * *" (00:05 SGT, bills) and "0 11 * * *" (19:00 SGT, digest)
```

## Invariants — do not break these

1. **All money is integer cents.** Dollars exist only at the UI edge
   (input parsing multiplies by 100 and rounds; display divides by 100).
   Never store or compute balances in floats.
2. **`expense_shares` always stores final resolved per-person cents**, whatever
   the split method. Balance math (`computeNet`) only ever reads shares — it is
   method-agnostic. `split_method` + `split_config` (jsonb) are stored purely so
   the edit form can reconstruct the user's original inputs. If you add a split
   method, extend `SplitConfig`/`resolveShares`, and the rest of the app needs
   no changes.
3. **Shares must sum exactly to the expense total.** `resolveShares` uses
   largest-remainder rounding; leftover cents go to the payer first, then lowest
   member id. This determinism is intentional (same input → same split). Keep it.
4. **Balances are derived, never stored.** Net = (paid on others' behalf) −
   (own shares) − (settlements made) + (settlements received). No running-total
   column anywhere; this makes edits/deletes of history trivially safe.
5. **`db()` is a lazy singleton** (`src/db/index.ts`) and every DB-touching page
   exports `dynamic = "force-dynamic"`. This is what lets `next build` succeed
   with no DATABASE_URL (CI, sandboxes). Don't hoist a top-level db connection
   or remove force-dynamic without understanding this.
6. **Every server action re-authorizes.** First line is effectively
   `requireMember(slug)`, and every query filters by `houseId` from the session
   — never trust ids from the form alone. The unguessable link is the only
   perimeter, so this per-action scoping is the entire security model.
7. **Cron is idempotent per month** via `recurring_templates.last_posted_month`
   ("YYYY-MM"). A template posts when SGT day-of-month ≥ its (clamped) day and
   it hasn't posted this month. Late/missed runs self-heal on the next run.
   Day-31 templates post on the last day of short months (`min(day, daysInMonth)`).
8. **All date logic for posting uses Asia/Singapore** (`sgToday()` via Intl),
   never server-local time — Vercel runs UTC.
9. **Split validation happens at template save time too** (`saveTemplate` calls
   `resolveShares` and discards the result) so a bad template fails loudly in
   the UI, not silently at 00:05 on the 1st.
10. **Shopping item status is derived, never stored as an enum**, same
    philosophy as balances: open = `bought_at IS NULL`, bought = `bought_at
    NOT NULL AND archived_at IS NULL`, archived = hidden from the UI.
    `clearBought` only ever sets `archived_at` — it never deletes rows.
11. **`house_events` (calendar reminders) and `recurring_templates` (bill
    auto-posting) must never be merged**, even though both are "monthly
    recurrence" shaped. `recurring_templates` posts a ledger expense — wrong
    output there is money. `house_events` sends a reminder — wrong output
    there is a message. It's expected and correct for a house to have both a
    "Rent" template (posts the expense on the 1st) and a "Pay landlord" event
    (reminds on the 30th/31st) for the same real-world bill. Event reminder
    delivery is folded into `/api/digest` (which already runs daily) rather
    than given its own cron — Vercel Hobby's cron slots are scarce and both
    existing slots (`/api/cron`, `/api/digest`) are already spoken for.
12. **Calendar occurrences (month/week grid) are derived at render time via
    `projectOccurrences` (`lib/events.ts`), never stored.** `house_events` rows
    only ever persist the single next occurrence (`next_date`) plus the
    recurrence rule — same philosophy as Invariant 4 (balances) and Invariant
    10 (shopping status). One-off events (`freq: "none"`) always display at
    their stored `next_date` regardless of `active`, so calendar history is
    preserved (a past dinner still shows when you navigate back to that week).
    Recurring events project past+future occurrences from their rule while
    `active=1`; once paused (`active=0`), only occurrences on or before today
    keep showing — future projection stops immediately, past history does not
    disappear. This policy lives in `buildCalendarData`
    (`app/h/[slug]/app/events/calendar-data.ts`), not inside
    `projectOccurrences` itself, which stays a pure "what does this rule show
    in this range" function with no opinion on `active`.
13. **`lib/calendar-grid.ts` must never import from `lib/events.ts`** (only
    from `lib/date-strings.ts`). `lib/events.ts` imports `db`/`telegram` and
    is server-only; `calendar-grid.ts`'s month/week grid and timed-block
    layout math is imported directly by client components
    (`month-grid.tsx`/`week-grid.tsx`/`calendar-view.tsx`), so any transitive
    server dependency there would break the client bundle. `lib/date-strings.ts`
    (parseDate/fmtDate/addDays) is the shared zero-dependency base both
    `lib/events.ts` and `lib/calendar-grid.ts` build on — don't duplicate that
    string math a third time.

## Conventions

- Mutations = server actions with `useFormState` for error display; errors are
  returned as `{ error: string }`, thrown inside a try/catch — user-facing
  message strings, not stack traces.
- Auth-gated pages call `requireMember(params.slug)` first; it redirects to the
  house login on any mismatch.
- `revalidatePath` after every mutation touching dashboard data.
- UI tokens live in `tailwind.config.ts` (paper/ink/accent teal palette) —
  reuse them; don't introduce ad-hoc hex values. `.tnum` class for any number
  column (tabular numerals). `fmtSGD()` for all money display.
- `expense-form.tsx` and `recurring-form.tsx` are near-duplicates by choice —
  they were kept separate rather than abstracted because their divergence
  (date vs day-of-month, active flag, delete semantics) made a shared component
  more complex than two files. Feel free to unify only if it genuinely reduces
  code.
- Member colors assigned round-robin from `MEMBER_COLORS` at join time.

## Commands & environment

```bash
npm run dev           # local dev
npm run build         # must pass with no DATABASE_URL set (only SESSION_SECRET)
npm run db:generate   # regenerate SQL after editing src/db/schema.ts
npm run db:migrate    # apply migrations (needs DATABASE_URL)
npx tsx <file>        # not a devDependency — npx fetches it on demand; used for quick logic testing
```

Env vars (`.env.example` documents them):
- `DATABASE_URL` — Supabase **transaction pooler** string (port 6543); the
  postgres client uses `prepare: false, max: 1` specifically because of
  pgBouncer transaction pooling + serverless. Keep those options.
- `SESSION_SECRET` — signs session JWTs.
- `CRON_SECRET` — Vercel sends `Authorization: Bearer <CRON_SECRET>` to
  `/api/cron` and `/api/digest` automatically when the env var exists.
- `TELEGRAM_BOT_TOKEN` — from @BotFather; `lib/telegram.ts` no-ops (never
  throws) if unset, so the app works fully without it.
- `TELEGRAM_WEBHOOK_SECRET` — verified against the
  `X-Telegram-Bot-Api-Secret-Token` header on every `/api/telegram` request;
  set as the `secret_token` param when calling Telegram's `setWebhook`.
- `APP_URL` — used to build the "settle up" link in digest messages.

Schema change workflow: edit `schema.ts` → `npm run db:generate` → commit the
new file in `drizzle/` → run `db:migrate` against prod → deploy.

## Known quirks / gotchas

- Supabase free tier pauses after ~1 week idle; first request after resumes it
  (slow first load). Owner knows and accepted this.
- The cron schedule in `vercel.json` only activates on a production deploy.
- `members` are never hard-deleted — several FKs (payer, created_by, shares)
  reference them, so `/h/[slug]/app/members` only supports soft-delete via
  the `active` flag (`toggleMemberActive`). Deactivated members are hidden
  from new expenses but their history and balances remain.
- No tests are wired into CI yet; split/balance math was verified with ad-hoc
  tsx scripts. **Good first task: turn those into real vitest tests for
  `lib/split.ts`, `lib/balances.ts`, `lib/recurring.ts`** — they're pure
  functions and the highest-stakes code in the app.
- `quickSettle` (the "Mark paid" button) records settlement dated today with a
  fixed note; the fuller `settleUp` action exists for arbitrary settlements but
  has no dedicated UI yet — dashboard suggestions cover the common case.

## Roadmap (agreed with owner)

1. **M5:** monthly summary (total + by category + per person), filters
   (month/category/person) on the feed, CSV export of any filtered view.
2. **v1.1 candidates remaining (unprioritized):** receipt photo upload, spend
   charts, saved split presets, house-link regeneration + optional house
   password, "log shopping item as expense" stretch. (Telegram notifications,
   shopping list, and house calendar all shipped — see Status above.)

When in doubt about product direction: optimize for the 4-person trusted
household, zero friction, and auditability — in that order.