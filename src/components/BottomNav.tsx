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
