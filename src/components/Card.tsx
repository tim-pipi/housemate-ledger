export function Card({
  as: Tag = "div",
  muted = false,
  flat = false,
  className = "",
  children,
}: {
  as?: "div" | "li";
  muted?: boolean;
  // Flat/bordered treatment instead of the default elevated white card —
  // for rows that should read as "already handled" (e.g. bought shopping
  // items), not another actionable surface.
  flat?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const surface = flat ? "border border-line" : "bg-white shadow-card";
  return (
    <Tag className={`rounded-xl p-3.5 ${surface} ${muted ? "opacity-60" : ""} ${className}`.trim()}>
      {children}
    </Tag>
  );
}
