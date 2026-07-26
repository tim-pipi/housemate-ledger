# Product Requirements Document — Housemate Finance Tracker

**Version:** 1.0 (Approved)
**Author:** Tim (drafted with Claude)
**Date:** 23 July 2026
**Status:** Approved — ready to build
**Decisions (v1.0):** Rent split = adjustment by room size; access via unguessable link only (no house password); recurring bills auto-post; all members can edit/delete any expense; Telegram deferred to v1.1.

---

## 1. Overview

A lightweight web application for a household sharing a flat to track shared expenses, split bills and rent, and settle balances. Access works like when2meet: a house lives at a unique link, and housemates log in on that page with just a username and optional password — no email signup, no accounts to create elsewhere. Initial target: one house with 4 users.

## 2. Problem Statement

Shared household costs — rent, utilities, groceries, one-off purchases — are paid by different people at different times. Without a shared ledger, it is hard to know who owes whom, settlements get delayed or forgotten, and disputes arise from missing records. Existing tools (e.g. Splitwise) work but gate useful features behind subscriptions, and their signup flow adds friction for a fixed household. The when2meet model removes that friction entirely.

## 3. Goals

- Zero-friction onboarding: a housemate opens the house link, types a username (+ optional password), and is in.
- Let any housemate log a shared expense in under 30 seconds.
- Always show an accurate, up-to-date "who owes whom" balance for the household.
- Support the full range of Splitwise-style split methods for any expense, including rent.
- Support recurring costs (rent, utilities, internet) without re-entering them monthly.
- Make settling up explicit and auditable.
- Accessible online from desktop and mobile browsers.

## 4. Non-Goals (v1)

- Handling actual money movement (no PayNow/bank integration — the app records settlements, it doesn't execute them).
- Email-based accounts, password recovery flows, or OAuth. Identity is house-scoped and lightweight by design.
- Native mobile apps. A responsive web app is sufficient.
- Multi-currency support (SGD only).
- Budgeting, forecasting, or personal (non-shared) expense tracking.

## 5. Users & Access Model (when2meet-style)

### 5.1 House creation
- Anyone can create a house: enter a house name → app generates a unique, unguessable URL, e.g. `app.com/h/x7Kp2mQ9`.
- Access is via the unguessable link alone — no house password (decided for v1; can be added later if the link ever leaks, and the link can be regenerated).
- The link is shared with housemates via chat.

### 5.2 Joining & logging in
- Visiting the house link shows the house login screen.
- A new user types a username → a member slot is created for them. They may optionally set a **personal password** to protect their identity within the house.
- A returning user picks/types their username (+ personal password if they set one) and is in.
- Session persists via cookie so daily use is one tap.

### 5.3 Security posture (deliberate trade-off)
- Security relies on the unguessable URL + optional personal passwords. This is when2meet's model: appropriate for a trusted household, not for sensitive data. The PRD accepts this trade-off in exchange for zero-friction access.
- House settings allow regenerating the link if it ever leaks.
- v1 ships with one house (ours), but the model naturally supports multiple houses at no extra cost.

## 6. Core Features (v1)

### 6.1 Expense Logging
- Fields: amount (SGD), description, category, date, payer, split method, participants.
- Categories: Rent, Utilities, Internet, Groceries, Household supplies, Food, Other (editable list).
- Any user can add an expense on behalf of any payer.
- Any member can edit or delete any expense (full-trust household), with a simple change log (who edited, when) for transparency.

### 6.2 Split Methods (Splitwise-style — applies to all expenses including rent)
- **Equally** — among selected participants (default: all members).
- **Exact amounts** — enter each person's share; must sum to total.
- **Percentages** — enter each person's %; must sum to 100%.
- **Shares** — assign share units (e.g. 2 : 1 : 1 : 1); total divided proportionally. Useful for rooms of different sizes.
- **Adjustment (+/−)** — split equally, then add/subtract fixed amounts per person (e.g. "+$50 for the master room"); remainder split equally.
- The split UI shows a live preview of each person's resulting share and validates before saving.
- Rounding: shares computed in cents; any leftover cent(s) assigned deterministically (e.g. to the payer) so totals always reconcile.

### 6.3 Recurring Bills
- Recurring template: description, amount, category, payer, **any split method above**, frequency (monthly), day of month.
- App **auto-posts** the expense each cycle on the scheduled day — no confirmation step. Posted amounts can still be edited afterwards (e.g. variable utility bills adjusted once the actual bill arrives).
- Rent: monthly template using the **adjustment** split to reflect different room sizes (e.g. equal base + $X for the larger room).

### 6.4 Balances & Settlement
- Dashboard showing net balance per person and simplified pairwise debts ("A owes B $42.50").
- Debt simplification: minimize the number of transfers needed to settle.
- "Settle up" action: record a payment from one person to another (amount, date, optional note); balances update immediately.

### 6.5 History & Transparency
- Chronological activity feed of all expenses and settlements.
- Filter by month, category, or person.
- Monthly summary: total household spend, spend by category, per-person contribution.
- CSV export of any filtered view.

## 7. Nice-to-Haves (v1.1+)

- Receipt photo upload attached to an expense.
- Telegram bot or notification when a new expense is added or a bill is due.
- Simple charts (spend by category over time).
- "Nudge" a housemate who owes money.
- Saved split presets ("our usual rent split") reusable on any expense.

## 8. Key User Flows

1. **First-time join:** Housemate opens `app.com/h/x7Kp2mQ9` from the group chat → types "Jon" → sets a password (or skips) → lands on the dashboard.
2. **Log a grocery run:** Add expense → $63.40, Groceries, paid by Tim, split equally → Save. Feed and balances update for everyone.
3. **Monthly rent:** On the 1st, the rent template (adjustment split: equal base + room-size top-ups) auto-posts → appears in the feed and balances immediately.
4. **Settle up:** B sees they owe A $85 → transfers via PayNow outside the app → records "Settled $85 to A" → balances zero out.

## 9. Data Model (Sketch)

- **houses** — id, name, slug (unguessable), house_password_hash (nullable), created_at
- **members** — id, house_id, username, password_hash (nullable), color, created_at *(unique per house on username)*
- **expenses** — id, house_id, description, amount_cents, category, date, payer_member_id, split_method, created_by, created_at, updated_at
- **expense_shares** — expense_id, member_id, share_amount_cents *(final resolved amounts, whatever the split method)*
- **recurring_templates** — id, house_id, description, amount_cents, category, payer_member_id, split_config (JSON: method + params), day_of_month, active
- **settlements** — id, house_id, from_member_id, to_member_id, amount_cents, date, note

Store money as integer cents. Balances are derived, not stored. `expense_shares` always stores the resolved per-person amounts, so balance math is identical regardless of split method; `split_config`/`split_method` is kept for editing and display.

## 10. Tech Stack (Proposed)

Optimized for: ~4 users, near-zero cost, minimal ops, one engineer.

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Full-stack in one codebase — UI, API routes, server logic. |
| UI | **Tailwind CSS + shadcn/ui** | Fast, clean, responsive mobile-friendly UI. |
| Database | **Postgres via Supabase (free tier)** | Managed Postgres; free tier easily covers this scale. |
| Auth | **Custom lightweight auth** (house slug + username + bcrypt-hashed optional passwords, signed session cookie via `iron-session` or Auth.js credentials provider) | The when2meet model doesn't fit email-based auth providers; a small custom layer is simpler and exactly matches the access model. |
| ORM | **Drizzle** (or Prisma) | Type-safe queries against Postgres. |
| Hosting | **Vercel (free/Hobby tier)** | Git-push deploys, free HTTPS, custom domain support. |
| Recurring jobs | **Vercel Cron** | Trigger monthly bill generation per active template. |

**Estimated running cost: $0/month** (optionally ~US$10/yr for a custom domain).

**Notes on the auth change:** dropping Supabase Auth means we use Supabase purely as a Postgres host (connect via Drizzle, enforce access in the app layer, not RLS). All house data access is scoped server-side by the session's house_id.

**Alternatives considered:** SvelteKit (fine, smaller ecosystem); single VPS (needless ops burden); Firebase (SQL fits a ledger better).

## 11. Milestones

1. **M1 — Foundation:** Repo, Next.js + Postgres setup, house creation + link, join/login flow with sessions, deploy skeleton to Vercel.
2. **M2 — Core ledger:** Expense CRUD with all five split methods + live preview, balances view with debt simplification.
3. **M3 — Settlements & feed:** Settle-up flow, activity feed, filters, monthly summary.
4. **M4 — Recurring bills:** Templates + cron auto-posting, post-hoc edit flow.
5. **M5 — Polish:** Mobile UX pass, CSV export, onboard the housemates via the house link.

## 12. Success Criteria

- All 4 housemates join via the link and log expenses within the first week — with no help needed beyond receiving the URL.
- Rent handled via a recurring template with an unequal split for two consecutive months without manual re-entry.
- Zero "wait, who paid for that?" disputes the ledger can't answer.

## 13. Resolved Decisions

1. **Rent split:** adjustment by room size (equal base + fixed top-ups per room).
2. **House access:** unguessable link alone; no house password in v1.
3. **Recurring bills:** auto-post on schedule, editable after posting.
4. **Permissions:** any member can edit/delete any expense (full trust, with change log).
5. **Telegram notifications:** deferred to v1.1.
