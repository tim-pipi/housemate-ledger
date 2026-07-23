# Deployment Setup (one-time, ~15 minutes)

These are the steps only you can do (they need your accounts).

## 1. Supabase — the database

1. Sign up at supabase.com (free) → **New project** (pick Singapore region).
2. Set a strong database password when prompted — save it. password: 2CILizWXl7FsRYZi
3. Go to **Project Settings → Database → Connection string → URI** and copy the
   **Transaction pooler** string (port 6543). It looks like:
   `postgresql://postgres.oehozcvlncrtuohihepi:2CILizWXl7FsRYZi@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`
4. Replace `[PASSWORD]` with your database password. This is your `DATABASE_URL`.

We use Supabase purely as a Postgres host — its Auth/RLS features are unused
(the app has its own link-based login).

## 2. Run the database migration

From this project folder on your machine:

```bash
npm install
DATABASE_URL="postgresql://postgres.oehozcvlncrtuohihepi:2CILizWXl7FsRYZi@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres" npm run db:migrate
```

This creates all tables (houses, members, expenses, expense_shares, settlements,
recurring_templates). You only re-run this when the schema changes.

## 3. GitHub

Create a repo and push:

```bash
git init && git add -A && git commit -m "Housemate Ledger M1+M2"
git remote add origin git@github.com:<you>/housemate-ledger.git
git push -u origin main
```

## 4. Vercel — hosting

1. Sign up at vercel.com with your GitHub account (free Hobby plan).
2. **Add New → Project** → import the repo. Framework auto-detects as Next.js.
3. Under **Environment Variables**, add:
   - `DATABASE_URL` — the Supabase pooler string from step 1
   - `SESSION_SECRET` — any long random string: `openssl rand -base64 32`
4. Deploy. You'll get `https://<project>.vercel.app`.

## 5. Create your house

Open the deployed URL → create your house → copy the `/h/...` link into your
housemates' group chat. Each person opens it, types a username (optionally sets
a password), and they're in.

## Later (M4 — recurring bills)

When we build cron auto-posting, you'll add a `vercel.json` cron entry hitting a
`/api/cron` route daily; the `recurring_templates` table is already in place.

## Notes

- Free tiers: Supabase pauses projects after ~1 week of zero activity on the free
  plan — opening the app resumes it, or upgrade later if it annoys you.
- The unguessable link is the security boundary. Don't post it publicly; if it
  ever leaks we can add link regeneration + house password quickly.
