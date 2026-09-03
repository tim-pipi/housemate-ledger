# Persistent bottom navigation — design

Status: approved, pending implementation plan
Date: 2026-09-03

## Problem

The app currently has no persistent navigation. Every feature area
(Shopping, Calendar, Recurring, Members, Telegram) is reached from a
"Go to" tile grid on the dashboard and exited via a "← Back to
dashboard" link in `PageHeader`. For an app opened repeatedly through
the day by the same 4 housemates, this means every switch between
features costs two navigations (back to dashboard, then into the next
tile) instead of one.

This was flagged during a general UI review (see prior conversation);
the owner confirmed a persistent bottom nav bar as the highest-value
fix to start with, ahead of other polish items (member-color avatars
in the activity feed, icons on nav tiles, dashboard information
hierarchy) which remain unscoped follow-ups, not part of this spec.

## Goals

- Cut navigation between the app's frequent-use areas (Home, Shopping,
  Calendar, Activity) to one tap from anywhere.
- Keep the less-frequently-used settings-shaped areas (Recurring,
  Members, Telegram) reachable, without cluttering the primary tab bar.
- Declutter the dashboard now that its "Go to" grid becomes redundant.

## Non-goals

- No changes to page *content* beyond what's needed to make room for
  the nav bar (FAB position) or align a couple of pages to the
  existing `PageHeader` convention.
- No desktop-specific nav layout — the app is already mobile-first
  (`max-w-2xl` containers) and used mostly on phones; the bar stays at
  the bottom at all widths.
- No changes to `lib/`, server actions, or the DB schema. Pure
  presentation-layer restructuring.

## Design

### 1. Shared layout + visibility rule

There is currently no `layout.tsx` under `src/app/h/[slug]/app/` —
each page is a sibling with no shared chrome. Add
`src/app/h/[slug]/app/layout.tsx`:

```tsx
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

`BottomNav` (`src/components/BottomNav.tsx`, `"use client"`) reads
`usePathname()` and decides visibility via an **exact-path allowlist**
— not regex-matching dynamic segments, which would be fragile against
future routes. It renders only when the pathname (with the `/h/<slug>`
prefix stripped) is one of:

```
/app
/app/activity
/app/shopping
/app/events
/app/recurring
/app/members
/app/telegram
/app/more
```

Every other route — every `/new` and every dynamic `/[id]` edit page
(`expenses/new`, `expenses/[id]`, `events/new`, `events/[id]`,
`recurring/new`, `recurring/[id]`, `members/[memberId]`) — renders no
nav bar, matching how those pages work today (full-focus form, `Cancel`
button, no competing chrome at the bottom of the screen).

Pages that render the bar need bottom padding (`pb-20` or similar) so
their last item isn't obscured by the fixed bar — most already have
generous bottom padding (the dashboard already uses `pb-24` for the
FAB) so this is a small per-page adjustment, not a new pattern.

### 2. Tabs, icons, active-state mapping

5 tabs, using `lucide-react` (new dependency):

| Tab | Icon | Route | Active on |
|---|---|---|---|
| Home | `Home` | `/app` | `/app` exactly |
| Shopping | `ShoppingCart` | `/app/shopping` | `/app/shopping` |
| Calendar | `CalendarDays` | `/app/events` | `/app/events` |
| Activity | `Receipt` | `/app/activity` | `/app/activity` |
| More | `MoreHorizontal` | `/app/more` | `/app/more`, `/app/recurring`, `/app/members`, `/app/telegram` |

`Receipt` was chosen over a generic "activity/pulse" icon because the
app's balances card already uses a receipt visual motif
(`receipt-edge` in `globals.css`) — the icon should reinforce that,
not introduce an unrelated metaphor.

Active-tab styling: accent-teal icon + label, matching the existing
`accent`/`accentdark` tokens already used for active/selected states
elsewhere (e.g. the recurrence-frequency pills in `event-form.tsx`).

### 3. New `/app/more` page

`src/app/h/[slug]/app/more/page.tsx` — a landing page reusing the
existing `NavTile` component (`src/components/NavTile.tsx`, already
used by the dashboard's "Go to" grid) for the three relocated
destinations: Recurring bills, Members, Telegram. Same visual pattern,
just moved. No new component needed here.

### 4. Dashboard changes

`src/app/h/[slug]/app/page.tsx`:

- **Remove the "Go to" NavTile grid entirely.** Once Shopping and
  Calendar are primary tabs and Recurring/Members/Telegram live under
  More, every tile in that grid duplicates a nav-bar destination — it
  has nothing left to show.
- **Reposition the FAB** from `bottom-6 right-6` to `bottom-20 right-6`
  (clears the ~64px nav bar plus margin) so it stacks above the bar
  instead of overlapping it.
- Add bottom padding to the page (increase from `pb-24`, since the FAB
  now sits higher — the exact value gets tuned during implementation
  against the real rendered nav bar height, not hand-computed here).

No other dashboard section (Balances, Settle up, Upcoming, Activity
preview) changes — removing the Go to grid alone moves them further up
the page, which was the secondary goal (surface actionable content
sooner) called out during the earlier UI review.

### 5. Align `members/page.tsx` and `telegram/page.tsx` to `PageHeader`

These two pages currently hand-roll their own `← Back` link + `<h1>`
instead of using the shared `PageHeader` component that every other
list page (`recurring/page.tsx`, `shopping/page.tsx`,
`events/page.tsx`) already uses. Since both pages are being touched
anyway (they move under the "More" tab, so their back-link target
changes from `/app` to `/app/more`), this is the natural moment to
also fix the inconsistency rather than leave two files as the only
holdouts from the shared pattern.

### 6. File touch-list

**New:**
- `src/app/h/[slug]/app/layout.tsx`
- `src/components/BottomNav.tsx`
- `src/app/h/[slug]/app/more/page.tsx`

**Edited:**
- `src/app/h/[slug]/app/page.tsx` (remove Go to grid, reposition FAB, padding)
- `src/app/h/[slug]/app/members/page.tsx` (switch to `PageHeader`, back target → `/app/more`)
- `src/app/h/[slug]/app/telegram/page.tsx` (switch to `PageHeader`, back target → `/app/more`)
- `package.json` (add `lucide-react`)

**Untouched:** every form page (`expenses/new`, `expenses/[id]`,
`events/new`, `events/[id]`, `recurring/new`, `recurring/[id]`,
`members/[memberId]`), `shopping/page.tsx`, `events/page.tsx`,
`recurring/page.tsx`, `activity/page.tsx` — the nav bar is additive
chrome from the shared layout; these pages don't need internal
changes beyond what bottom padding the layout already provides.

## Testing

No new business logic — this is presentation-only, so no new unit
tests. Verification is: `tsc --noEmit`, `npm run build`, and a manual
click-through (since `npm run dev` needs a real `DATABASE_URL`, this
may need to happen against the deployed Vercel preview or the owner's
local `.env` — flag this during implementation rather than skip
verification silently).

Manual check-list:
- [ ] Nav bar visible on all 8 allowlisted routes, hidden on every form route
- [ ] Active tab highlights correctly on every route, including all 3 "More" children
- [ ] FAB no longer overlaps the nav bar on the dashboard
- [ ] Dashboard's Go to grid is gone; Balances/Settle up/Upcoming/Activity still render correctly
- [ ] `/app/more` lists Recurring/Members/Telegram via `NavTile`, same as the old grid did
- [ ] `members/page.tsx` and `telegram/page.tsx` render via `PageHeader` with a working back link to `/app/more`
- [ ] No layout shift/overlap at narrow (375px) and wide (1280px) viewport widths
