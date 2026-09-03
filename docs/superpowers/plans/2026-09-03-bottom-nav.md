# Persistent Bottom Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard-tile + "back to dashboard" navigation pattern with a persistent 5-tab bottom nav bar (Home/Shopping/Calendar/Activity/More), visible only on browse/list pages.

**Architecture:** A new shared `layout.tsx` under `src/app/h/[slug]/app/` renders every page plus a client `BottomNav` component. `BottomNav` uses `usePathname()` and an exact-path allowlist to decide visibility and which tab is active — no route restructuring, no changes to existing form pages. A new `/app/more` page absorbs the "Go to" tiles for Recurring/Members/Telegram that the primary tab bar has no room for.

**Tech Stack:** Next.js 14 App Router, React 18, Tailwind CSS, `lucide-react` (new dependency, icons only).

**Spec:** `docs/superpowers/specs/2026-09-03-bottom-nav-design.md`

## Global Constraints

- Exact-path allowlist for nav visibility (not regex on dynamic segments) — visible only on `/app`, `/app/activity`, `/app/shopping`, `/app/events`, `/app/recurring`, `/app/members`, `/app/telegram`, `/app/more`.
- 5 tabs: Home (`Home` icon → `/app`), Shopping (`ShoppingCart` → `/app/shopping`), Calendar (`CalendarDays` → `/app/events`), Activity (`Receipt` → `/app/activity`), More (`MoreHorizontal` → `/app/more`, also active on `/app/recurring`, `/app/members`, `/app/telegram`).
- Nav bar fixed height `h-16` (64px) so page bottom-padding math is exact, not guessed.
- No dark mode, no desktop-specific layout — bar stays at the bottom at all widths (already-approved decision).
- No changes to `lib/`, server actions, or the DB schema — presentation layer only.
- No new automated tests — verify with `npx tsc --noEmit` and `npm run build` after every task (this repo has no test suite yet, per CLAUDE.md).
- **Deviation from spec, caught during planning:** the spec listed `shopping/page.tsx`, `events/page.tsx`, `recurring/page.tsx`, `activity/page.tsx` as "untouched." That's wrong — those pages currently have `py-6` (24px) bottom padding, not enough to clear a fixed 64px nav bar without the last list item being hidden behind it. Task 8 adds a one-line padding bump to each. This is called out to the user in the plan-completion summary, not silently absorbed.

---

### Task 1: Add lucide-react dependency

**Files:**
- Modify: `package.json` (via `npm install`, not hand-edited)

**Interfaces:**
- Produces: the `lucide-react` package, importable as `import { IconName } from "lucide-react"` in later tasks.

- [ ] **Step 1: Install the package**

Run: `npm install lucide-react`

- [ ] **Step 2: Verify it landed in package.json**

Run: `grep lucide-react package.json`
Expected: a line like `"lucide-react": "^0.4XX.0",` under `dependencies`.

- [ ] **Step 3: Verify the project still type-checks and builds**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (success).

Run: `npm run build`
Expected: `✓ Compiled successfully`, ending in a route table (same as before, no new routes yet).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add lucide-react for bottom nav icons"
```

---

### Task 2: Create the BottomNav component

**Files:**
- Create: `src/components/BottomNav.tsx`

**Interfaces:**
- Consumes: `lucide-react` icons (Task 1), `next/navigation`'s `usePathname`, `next/link`'s `Link`.
- Produces: `export function BottomNav({ slug }: { slug: string }): JSX.Element | null` — a client component. Later tasks (3) import this from `@/components/BottomNav`.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingCart, CalendarDays, Receipt, MoreHorizontal, type LucideIcon } from "lucide-react";

// Exact-path allowlist, not regex on dynamic segments — deliberately explicit
// so a future new route doesn't accidentally show/hide the bar by matching a
// pattern nobody intended. Paths are relative to `/h/<slug>/app`.
const VISIBLE_PATHS = new Set(["", "/activity", "/shopping", "/events", "/recurring", "/members", "/telegram", "/more"]);

const MORE_PATHS = new Set(["/more", "/recurring", "/members", "/telegram"]);

type Tab = {
  key: string;
  label: string;
  relHref: string;
  icon: LucideIcon;
  isActive: (rel: string) => boolean;
};

const TABS: Tab[] = [
  { key: "home", label: "Home", relHref: "", icon: Home, isActive: (r) => r === "" },
  { key: "shopping", label: "Shopping", relHref: "/shopping", icon: ShoppingCart, isActive: (r) => r === "/shopping" },
  { key: "calendar", label: "Calendar", relHref: "/events", icon: CalendarDays, isActive: (r) => r === "/events" },
  { key: "activity", label: "Activity", relHref: "/activity", icon: Receipt, isActive: (r) => r === "/activity" },
  { key: "more", label: "More", relHref: "/more", icon: MoreHorizontal, isActive: (r) => MORE_PATHS.has(r) },
];

export function BottomNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/h/${slug}/app`;
  const rel = pathname === base ? "" : pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : null;

  if (rel === null || !VISIBLE_PATHS.has(rel)) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-2xl items-stretch justify-around px-2">
        {TABS.map((tab) => {
          const active = tab.isActive(rel);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.key}
              href={`${base}${tab.relHref}`}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                active ? "text-accent" : "text-inkmuted hover:text-accent"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output. (The component isn't imported anywhere yet, so this only checks the file compiles in isolation — full wiring is verified in Task 3.)

- [ ] **Step 3: Commit**

```bash
git add src/components/BottomNav.tsx
git commit -m "Add BottomNav component"
```

---

### Task 3: Wire BottomNav into a shared app layout

**Files:**
- Create: `src/app/h/[slug]/app/layout.tsx`

**Interfaces:**
- Consumes: `BottomNav` from Task 2 (`@/components/BottomNav`).
- Produces: every page under `src/app/h/[slug]/app/**` now renders inside this layout automatically (Next.js App Router convention — no per-page changes needed for the wiring itself).

- [ ] **Step 1: Write the layout**

```tsx
import { BottomNav } from "@/components/BottomNav";

export default function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  return (
    <>
      {children}
      <BottomNav slug={params.slug} />
    </>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output.

Run: `npm run build`
Expected: `✓ Compiled successfully` and the route table still lists the same routes as before (a `layout.tsx` doesn't add a route of its own).

- [ ] **Step 3: Commit**

```bash
git add src/app/h/\[slug\]/app/layout.tsx
git commit -m "Add shared app layout rendering BottomNav"
```

---

### Task 4: Create the /app/more landing page

**Files:**
- Create: `src/app/h/[slug]/app/more/page.tsx`

**Interfaces:**
- Consumes: `requireMember` (`@/lib/guard`), `PageHeader` (`@/components/PageHeader`), `NavTile` (`@/components/NavTile`) — all existing, unchanged.
- Produces: route `/h/[slug]/app/more`, which Tasks 5, 6, 7 link to.

- [ ] **Step 1: Write the page**

```tsx
import { requireMember } from "@/lib/guard";
import { PageHeader } from "@/components/PageHeader";
import { NavTile } from "@/components/NavTile";

export const dynamic = "force-dynamic";

export default async function More({ params }: { params: { slug: string } }) {
  await requireMember(params.slug);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 sm:px-6">
      <PageHeader backHref={`/h/${params.slug}/app`} title="More" />
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <NavTile
          href={`/h/${params.slug}/app/recurring`}
          label="Recurring bills"
          description="Auto-posted monthly"
        />
        <NavTile
          href={`/h/${params.slug}/app/members`}
          label="Members"
          description="House roster"
        />
        <NavTile
          href={`/h/${params.slug}/app/telegram`}
          label="Telegram"
          description="Notifications"
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output.

Run: `npm run build`
Expected: `✓ Compiled successfully`; route table now includes `ƒ /h/[slug]/app/more`.

- [ ] **Step 3: Commit**

```bash
git add src/app/h/\[slug\]/app/more/page.tsx
git commit -m "Add /app/more landing page for Recurring/Members/Telegram"
```

---

### Task 5: Update the dashboard — remove Go to grid, reposition FAB

**Files:**
- Modify: `src/app/h/[slug]/app/page.tsx`

**Interfaces:**
- Consumes: nothing new.

- [ ] **Step 1: Remove the "Go to" NavTile grid section and its now-unused imports**

In `src/app/h/[slug]/app/page.tsx`, delete this whole section:

```tsx
      {/* Feature nav */}
      <section className="mt-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-inkmuted">
          Go to
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <NavTile
            href={`/h/${params.slug}/app/shopping`}
            label="Shopping"
            description="Household list"
            count={openShoppingItems.length}
          />
          <NavTile
            href={`/h/${params.slug}/app/recurring`}
            label="Recurring bills"
            description="Auto-posted monthly"
          />
          <NavTile
            href={`/h/${params.slug}/app/events`}
            label="Calendar"
            description="Reminders"
          />
          <NavTile
            href={`/h/${params.slug}/app/members`}
            label="Members"
            description="House roster"
          />
          <NavTile
            href={`/h/${params.slug}/app/telegram`}
            label="Telegram"
            description="Notifications"
          />
        </div>
      </section>

```

Then remove the now-unused `NavTile` import:

```tsx
import { NavTile } from "@/components/NavTile";
```

`openShoppingItems` is still used elsewhere on the page (verify with `grep -n openShoppingItems src/app/h/\[slug\]/app/page.tsx` — it's part of the `Promise.all` destructure and no longer referenced after this deletion beyond that; the query itself becomes dead weight). Since the query result has no remaining consumer after this edit, remove the query and its slot from the `Promise.all` too:

```tsx
  const [exp, setl, openShoppingItems, upcomingEvents] = await Promise.all([
    db().query.expenses.findMany({
      where: eq(expenses.houseId, house.id),
      orderBy: [desc(expenses.date), desc(expenses.id)],
    }),
    db().query.settlements.findMany({
      where: eq(settlements.houseId, house.id),
      orderBy: [desc(settlements.date), desc(settlements.id)],
    }),
    db().query.shoppingItems.findMany({
      where: and(
        eq(shoppingItems.houseId, house.id),
        isNull(shoppingItems.boughtAt),
        isNull(shoppingItems.archivedAt)
      ),
      columns: { id: true },
    }),
    db().query.houseEvents.findMany({
      where: and(eq(houseEvents.houseId, house.id), eq(houseEvents.active, 1), gte(houseEvents.nextDate, today)),
      orderBy: (t, { asc }) => [asc(t.nextDate)],
      limit: 3,
    }),
  ]);
```

becomes:

```tsx
  const [exp, setl, upcomingEvents] = await Promise.all([
    db().query.expenses.findMany({
      where: eq(expenses.houseId, house.id),
      orderBy: [desc(expenses.date), desc(expenses.id)],
    }),
    db().query.settlements.findMany({
      where: eq(settlements.houseId, house.id),
      orderBy: [desc(settlements.date), desc(settlements.id)],
    }),
    db().query.houseEvents.findMany({
      where: and(eq(houseEvents.houseId, house.id), eq(houseEvents.active, 1), gte(houseEvents.nextDate, today)),
      orderBy: (t, { asc }) => [asc(t.nextDate)],
      limit: 3,
    }),
  ]);
```

Then remove the now-unused `shoppingItems` import and `isNull` from the drizzle-orm import:

```tsx
import { expenses, expenseShares, settlements, shoppingItems, houseEvents } from "@/db/schema";
import { and, eq, gte, desc, inArray, isNull } from "drizzle-orm";
```

becomes:

```tsx
import { expenses, expenseShares, settlements, houseEvents } from "@/db/schema";
import { and, eq, gte, desc, inArray } from "drizzle-orm";
```

- [ ] **Step 2: Reposition the FAB and widen bottom padding to clear both the FAB and the nav bar**

Change:

```tsx
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 sm:px-6">
```

to:

```tsx
    <main className="mx-auto max-w-2xl px-4 pb-36 pt-6 sm:px-6">
```

Change:

```tsx
      {/* Add expense FAB */}
      <Link
        href={`/h/${params.slug}/app/expenses/new`}
        className="fixed bottom-6 right-6 rounded-full bg-accent px-5 py-3 font-display font-semibold text-white shadow-card transition-colors hover:bg-accentdark"
      >
        + Add expense
      </Link>
```

to:

```tsx
      {/* Add expense FAB — bottom-20 clears the 64px bottom nav bar (h-16) with a margin */}
      <Link
        href={`/h/${params.slug}/app/expenses/new`}
        className="fixed bottom-20 right-6 rounded-full bg-accent px-5 py-3 font-display font-semibold text-white shadow-card transition-colors hover:bg-accentdark"
      >
        + Add expense
      </Link>
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (confirms no leftover references to `NavTile`, `shoppingItems`, `isNull`, or `openShoppingItems`).

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add src/app/h/\[slug\]/app/page.tsx
git commit -m "Remove dashboard Go to grid, reposition FAB above bottom nav"
```

---

### Task 6: Align members/page.tsx to PageHeader

**Files:**
- Modify: `src/app/h/[slug]/app/members/page.tsx`

**Interfaces:**
- Consumes: `PageHeader` (`@/components/PageHeader`, existing), the `/app/more` route from Task 4.

- [ ] **Step 1: Replace the hand-rolled back-link + title with PageHeader, add nav-bar bottom padding**

Full replacement file:

```tsx
import Link from "next/link";
import { requireMember } from "@/lib/guard";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { toggleMemberActive } from "./actions";

export const dynamic = "force-dynamic";

export default async function MembersPage({ params }: { params: { slug: string } }) {
  const { me, houseMembers } = await requireMember(params.slug);

  return (
    <main className="mx-auto max-w-xl px-4 pb-24 pt-6 sm:px-6">
      <PageHeader backHref={`/h/${params.slug}/app/more`} backLabel="← Back" title="Members" />

      <ul className="mt-6 space-y-2">
        {houseMembers.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between rounded-xl bg-white p-4 shadow-card"
          >
            <div className="flex items-center gap-3">
              <span
                className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ background: m.color, opacity: m.active ? 1 : 0.5 }}
              >
                {m.username.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <p className="font-medium">
                  {m.username}
                  {m.id === me.id && (
                    <span className="ml-1.5 text-xs text-inkmuted">(you)</span>
                  )}
                </p>
                <p className="text-xs text-inkmuted">
                  {m.active ? "Active" : "Inactive"}
                  {m.passwordHash ? " · password set" : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {m.id !== me.id && (
                <form action={toggleMemberActive}>
                  <input type="hidden" name="slug" value={params.slug} />
                  <input type="hidden" name="memberId" value={m.id} />
                  <SubmitButton
                    className="btn-ghost px-3 py-1.5 text-sm"
                    pendingLabel={m.active ? "Deactivating…" : "Reactivating…"}
                  >
                    {m.active ? "Deactivate" : "Reactivate"}
                  </SubmitButton>
                </form>
              )}
              <Link
                href={`/h/${params.slug}/app/members/${m.id}`}
                className="btn-ghost px-3 py-1.5 text-sm"
              >
                Edit
              </Link>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-inkmuted">
        Deactivated members are hidden from new expenses but their history and balances remain.
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output.

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add src/app/h/\[slug\]/app/members/page.tsx
git commit -m "Align members page to PageHeader, link back to /app/more"
```

---

### Task 7: Align telegram/page.tsx to PageHeader

**Files:**
- Modify: `src/app/h/[slug]/app/telegram/page.tsx`

**Interfaces:**
- Consumes: `PageHeader` (`@/components/PageHeader`, existing), the `/app/more` route from Task 4.

- [ ] **Step 1: Replace the hand-rolled back-link + title with PageHeader, drop the now-unused Link import, add nav-bar bottom padding**

Full replacement file:

```tsx
import { requireMember } from "@/lib/guard";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { generateLinkCode, disconnectTelegram } from "./actions";

export const dynamic = "force-dynamic";

export default async function TelegramPage({ params }: { params: { slug: string } }) {
  const { house } = await requireMember(params.slug);

  return (
    <main className="mx-auto max-w-xl px-4 pb-24 pt-6 sm:px-6">
      <PageHeader backHref={`/h/${params.slug}/app/more`} backLabel="← Back" title="Telegram" />

      {house.telegramChatId ? (
        <div className="mt-6 rounded-xl bg-white p-4 shadow-card">
          <p className="text-sm">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-accent align-middle" />
            Connected — the linked group gets activity updates and a weekly digest.
          </p>
          <form action={disconnectTelegram} className="mt-3">
            <input type="hidden" name="slug" value={params.slug} />
            <SubmitButton className="btn-ghost px-3 py-1.5 text-sm" pendingLabel="Disconnecting…">
              Disconnect
            </SubmitButton>
          </form>
        </div>
      ) : (
        <div className="mt-6 rounded-xl bg-white p-4 shadow-card">
          <p className="text-sm text-inkmuted">Not connected.</p>
          {house.telegramLinkCode && (
            <div className="mt-3">
              <p className="text-sm">Add the bot to your group chat, then send:</p>
              <code className="mt-1 block rounded bg-paper px-3 py-2 font-mono text-sm">
                /link {house.telegramLinkCode}
              </code>
            </div>
          )}
          <form action={generateLinkCode} className="mt-3">
            <input type="hidden" name="slug" value={params.slug} />
            <SubmitButton className="btn-ghost px-3 py-1.5 text-sm" pendingLabel="Generating…">
              {house.telegramLinkCode ? "Generate new code" : "Connect Telegram"}
            </SubmitButton>
          </form>
        </div>
      )}

      <p className="mt-4 text-xs text-inkmuted">
        New expenses and settlements post to the linked group as they happen. A weekly
        digest goes out Sunday evenings with month-to-date spend and outstanding balances.
        In the group, <code>/balances</code> and <code>/summary</code> work on demand once linked.
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output.

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add src/app/h/\[slug\]/app/telegram/page.tsx
git commit -m "Align telegram page to PageHeader, link back to /app/more"
```

---

### Task 8: Add nav-bar clearance padding to the remaining browse pages, final verification

**Files:**
- Modify: `src/app/h/[slug]/app/shopping/page.tsx`
- Modify: `src/app/h/[slug]/app/events/page.tsx`
- Modify: `src/app/h/[slug]/app/recurring/page.tsx`
- Modify: `src/app/h/[slug]/app/activity/page.tsx`

**Interfaces:**
- Consumes: nothing new — one-line `className` edits only.

These four pages render on routes where `BottomNav` (Task 2/3) is visible, but each currently uses `py-6` (24px top+bottom), which isn't enough clearance for a fixed 64px nav bar — the last list item would render partially behind it. This was missed in the original spec's touch-list (it called these pages "untouched"); caught here during planning.

- [ ] **Step 1: Bump bottom padding on all four pages**

In `src/app/h/[slug]/app/shopping/page.tsx`, change:

```tsx
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
```

to:

```tsx
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 sm:px-6">
```

In `src/app/h/[slug]/app/events/page.tsx`, change:

```tsx
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
```

to:

```tsx
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6">
```

In `src/app/h/[slug]/app/recurring/page.tsx`, change:

```tsx
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
```

to:

```tsx
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 sm:px-6">
```

In `src/app/h/[slug]/app/activity/page.tsx`, change:

```tsx
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
```

to:

```tsx
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 sm:px-6">
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output.

Run: `rm -rf .next && npm run build`
Expected: `✓ Compiled successfully`, full route table including `ƒ /h/[slug]/app/more`, no warnings.

- [ ] **Step 3: Manual review checklist (no live DB in this environment — read the rendered JSX/classNames to confirm, and flag anything that needs the owner's eyes on the deployed preview)**

- [ ] Nav bar markup (Task 2) only renders for the 8 allowlisted relative paths — re-read `VISIBLE_PATHS` against the actual route folders under `src/app/h/[slug]/app/` to confirm no route was missed or extra.
- [ ] Every page that keeps the nav bar visible now ends in `pb-24` or more (dashboard: `pb-36`) — `grep -n 'className="mx-auto max-w' src/app/h/\[slug\]/app/**/page.tsx` and check each.
- [ ] `more/page.tsx`, `members/page.tsx`, `telegram/page.tsx` all link back correctly (`/app`, `/app/more`, `/app/more` respectively).
- [ ] Dashboard no longer imports or references `NavTile`, `shoppingItems`, `isNull`, or `openShoppingItems`.
- [ ] Note in the completion summary to the owner: verify actual spacing (FAB clearance, nav bar overlap) against the deployed Vercel preview or local dev with a real `DATABASE_URL`, since this environment can't render the app live.

- [ ] **Step 4: Commit**

```bash
git add src/app/h/\[slug\]/app/shopping/page.tsx src/app/h/\[slug\]/app/events/page.tsx src/app/h/\[slug\]/app/recurring/page.tsx src/app/h/\[slug\]/app/activity/page.tsx
git commit -m "Add bottom-nav clearance padding to shopping/calendar/recurring/activity pages"
```
