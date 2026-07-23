# Housemate Ledger

Track shared expenses, split bills Splitwise-style, and settle up — one when2meet-style
link per house, no accounts or emails.

**Stack:** Next.js 14 (App Router) + TypeScript · Tailwind CSS · Drizzle ORM · Postgres (Supabase) · Vercel

## What's built (M1 + M2 + settle-up)

- Create a house → unguessable link (`/h/<slug>`) to share with housemates
- Join/login with just a username + optional personal password (signed session cookie, 90 days)
- Expenses: add / edit / delete (any member, with created-by/edited-by trail)
- All 5 split methods with live per-person preview: equally, exact amounts, percentages,
  shares, adjustment (+/−) — cent-exact, remainders assigned to the payer first
- Balances dashboard: net per member + simplified "who pays whom" with one-tap **Mark paid**
- Activity feed (expenses + settlements), this-month spend total
- Recurring templates table already in the schema (cron auto-posting = next milestone)

## Local dev

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL + SESSION_SECRET
npm run db:migrate          # applies drizzle/ migrations to your database
npm run dev                 # http://localhost:3000
```

See SETUP.md for the full Supabase + Vercel deployment walkthrough.
