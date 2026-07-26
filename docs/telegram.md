# Telegram Integration — Design Doc (v1.1)

Companion to CLAUDE.md. Drop this in the repo (e.g. `docs/telegram.md`) so your
Claude Code session has it. It specifies *what to build and why*; implementation
detail is left to the coding session except where a choice is easy to get wrong.

## Goal

A Telegram bot that keeps the housemates' existing group chat in the loop:

1. **Activity notifications** — a message when an expense is added (manually or
   by the recurring cron) and when a settlement is recorded.
2. **Periodic digest** — a scheduled summary: spend so far this month, and the
   current "who pays whom" list (i.e. settlements not yet paid).
3. *(Optional, cheap to add once the webhook exists)* on-demand commands in the
   group: `/balances`, `/summary`.

## Architecture at a glance

```
Server actions ──► lib/telegram.ts ──► Telegram sendMessage API   (push, best-effort)
/api/cron (00:05 SGT) ──► post recurring bills ──► same notify path
/api/digest (2nd cron, evening SGT) ──► digest message
/api/telegram (webhook) ◄── Telegram ── /link, /balances commands
```

## Decisions & rationale

| Decision | Choice | Why |
|---|---|---|
| Bot ↔ house linking | `/link <code>` command in the group chat | The app can't know a group's chat_id; the bot learns it from a message sent *in that group*. A short link code (shown in the app) proves the linker belongs to the house. Pasting raw chat_ids into a settings page works but is hostile UX. |
| chat_id storage | `telegram_chat_id` (text, nullable) on `houses` | One group per house; nullable = integration off. Text, not integer — group ids are negative and can exceed int32. |
| Bot token scope | One bot, app-level `TELEGRAM_BOT_TOKEN` env var | Multi-house-safe (each house links its own chat) without per-house bot setup. |
| Notification triggers | Expense created (manual + cron), settlement recorded. **Not** edits/deletes in v1 | Signal over noise. Edits are frequent (adjusting auto-posted utilities) and would spam the group. Revisit only if the house asks. |
| Delivery guarantee | Best-effort, never blocks the mutation | A Telegram outage must not make "Add expense" fail. Wrap every send in try/catch with a short timeout; log and move on. See "Serverless gotcha". |
| Digest cadence | Weekly (Sunday evening SGT), monthly section on the 1st run of the month | Daily is noise for 4 people; weekly keeps debts from going stale. Cadence decided in code by checking the SGT date inside one daily cron route — no scheduler config per cadence. |
| Digest timing | Second Vercel cron, evening SGT (e.g. 11:00 UTC = 19:00 SGT) | The existing 00:05 cron is timed for bill posting; midnight is a terrible time to message humans. Vercel Hobby allows a small number of daily-precision crons (2 at last check — verify on current docs before assuming more). |
| Message format | HTML `parse_mode`, escape ALL user-supplied text | Descriptions/usernames are user input; unescaped `<` breaks messages and is an injection vector. MarkdownV2 escaping is famously fiddly — HTML is the sane choice. |
| Webhook security | `secret_token` param on `setWebhook`; verify `X-Telegram-Bot-Api-Secret-Token` header on every update | Otherwise anyone who finds the URL can forge bot updates (including `/link`). |
| Digest duplication guard | `last_digest_date` (text "YYYY-MM-DD") on `houses` | Cron retries/redeploys shouldn't double-message. Same idempotency pattern as `last_posted_month`. |

## Schema changes

```
houses + telegram_chat_id     text, nullable
houses + telegram_link_code   text, nullable   -- short random code, regenerable
houses + last_digest_date     text, nullable   -- "YYYY-MM-DD" (SGT)
```

Workflow reminder: edit `schema.ts` → `npm run db:generate` → commit `drizzle/`
→ `npm run db:migrate` against prod.

## Components to build

### 1. `lib/telegram.ts`
- `sendMessage(chatId, html)` — POST to
  `https://api.telegram.org/bot<TOKEN>/sendMessage` with
  `{ chat_id, text, parse_mode: "HTML", disable_web_page_preview: true }`,
  ~3–5s `AbortSignal.timeout`, try/catch, no throw to callers.
- `escapeHtml(s)` — escape `& < >` on every interpolated user string.
- `notifyHouse(houseId, html)` — look up `telegram_chat_id`; silently no-op if
  unlinked. This is the only function the rest of the app calls.

**Serverless gotcha:** on Vercel, work after the response is returned can be
killed, so a naive fire-and-forget `void fetch(...)` may silently never send.
Simplest correct approach on Next 14: `await` the notify (it's timeout-bounded
so worst case adds a few seconds once, only when Telegram is down). If that
bothers you, use `waitUntil` from `@vercel/functions` — but await-with-timeout
is fine at this scale.

### 2. Hook points (small diffs, reuse existing code)
- `saveExpense` (create branch only), `settleUp`, `quickSettle` in
  `app/h/[slug]/app/actions.ts`
- `postTemplate` in `lib/recurring.ts` — prefix these with 🔁 so auto-posted
  bills are distinguishable from manual entries.

Suggested formats (compact; the group chat is the UI here):

```
🧾 <b>NTUC grocery run</b> — S$63.40
Paid by Tim · Groceries · split equally 4 ways

💸 Jon paid Tim S$85.00 — settled

🔁 <b>Rent</b> — S$3,200.00 auto-posted
Tim S$950 · Jon S$750 · Mei S$750 · Alex S$750
```

### 3. `/api/telegram` webhook (POST)
- Verify the secret header; 200 immediately for update types you ignore
  (Telegram retries non-200s — never error on unknown updates).
- `/link <code>`: match code against `houses.telegram_link_code` → store
  `message.chat.id` as `telegram_chat_id`, clear the code, confirm in-chat.
- `/unlink`: clear `telegram_chat_id` for the chat's house.
- Optional: `/balances` and `/summary` — reuse `computeNet` + `simplify` and
  the digest renderer. These make the bot feel alive and cost almost nothing
  once the webhook exists.
- Register once: `setWebhook` with
  `url=https://<app>.vercel.app/api/telegram&secret_token=<TELEGRAM_WEBHOOK_SECRET>`.

### 4. Link UI in the app
Small section on the dashboard (or a settings page): "Connect Telegram" →
generates/regenerates `telegram_link_code`, shows
"Add @YourBot to your group, then send: <code>/link AB3XK9</code>".
Show linked/unlinked state; allow disconnect.

### 5. `/api/digest` + cron entry
- `vercel.json`: add `{ "path": "/api/digest", "schedule": "0 11 * * *" }`
  (19:00 SGT). Protect with the same `CRON_SECRET` Bearer check as `/api/cron`.
- Route logic per linked house, using `sgToday()`:
  - Skip unless Sunday (weekly) or day 1 (monthly) — or send weekly only and
    fold "month so far" into every digest; pick one and note it in CLAUDE.md.
  - Skip if `last_digest_date` is today (idempotency), set it after sending.
  - Content: month-to-date spend (total + top categories), then outstanding
    transfers from `simplify(computeNet(...))` — this *is* the
    "settlements that haven't been paid" list, no new bookkeeping needed:

```
📒 <b>Tampines 4B — weekly digest</b>
July so far: S$1,842.30 (Rent 3,200 posts on the 1st, Groceries S$412.30, …)

Outstanding:
• Jon → Tim S$142.50
• Mei → Tim S$85.00
All square? Settle up: <link to /h/<slug>/app>
```

## Env vars (add to `.env.example` + Vercel)

- `TELEGRAM_BOT_TOKEN` — from @BotFather
- `TELEGRAM_WEBHOOK_SECRET` — `openssl rand -hex 32`
- `APP_URL` — e.g. `https://<app>.vercel.app`, for links in messages

## Owner's manual steps (can't be done in code)

1. In Telegram, talk to **@BotFather** → `/newbot` → name it → copy the token.
2. Optional but recommended: `/setprivacy` → **Disable** privacy mode, so the
   bot can see `/link` and other commands in groups without being admin.
   (Alternatively make the bot a group admin and keep privacy on.)
3. Add the bot to your housemates' group chat.
4. Add the three env vars on Vercel, deploy, then call `setWebhook` once
   (curl or browser).
5. In the app, generate the link code and send `/link <code>` in the group.

## Testing checklist

- [ ] Add an expense → group message within seconds; app still works with
      `TELEGRAM_BOT_TOKEN` unset or wrong (no user-facing failure).
- [ ] "Mark paid" → settlement message.
- [ ] Wait for (or manually curl) `/api/cron` on a template's day → 🔁 message.
- [ ] `/link` with a bad code → polite refusal; good code → confirmation and
      `telegram_chat_id` stored.
- [ ] Webhook request without the secret header → 401.
- [ ] Digest: curl `/api/digest` twice on a Sunday → exactly one message.
- [ ] Description containing `<b>&` renders literally (escaping works).

## Explicitly out of scope (keep it that way for v1.1)

- DMs to individual members (everything goes to the one group — matches the
  full-trust household model).
- Inline buttons that mutate data from Telegram (e.g. "mark paid" button) —
  Telegram sender identity is not mapped to app members yet; read-only bot
  output avoids that auth problem entirely.
- Per-member notification preferences.