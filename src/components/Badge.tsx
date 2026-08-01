export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "accent";
  children: React.ReactNode;
}) {
  const cls =
    tone === "accent"
      ? "rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-white"
      : "rounded-full bg-line px-2 py-0.5 text-xs text-inkmuted";
  return <span className={cls}>{children}</span>;
}
