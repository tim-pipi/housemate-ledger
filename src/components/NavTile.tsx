import Link from "next/link";
import { Badge } from "./Badge";

export function NavTile({
  href,
  label,
  description,
  count,
}: {
  href: string;
  label: string;
  description: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-0.5 rounded-xl border border-line bg-white p-3.5 transition-colors hover:border-accent hover:bg-accentsoft/40"
    >
      <span className="flex items-center gap-2 font-display text-sm font-semibold">
        {label}
        {!!count && <Badge tone="accent">{count}</Badge>}
      </span>
      <span className="text-xs text-inkmuted">{description}</span>
    </Link>
  );
}
