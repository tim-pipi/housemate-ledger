export function Card({
  as: Tag = "div",
  muted = false,
  className = "",
  children,
}: {
  as?: "div" | "li";
  muted?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tag className={`rounded-xl bg-white p-3.5 shadow-card ${muted ? "opacity-60" : ""} ${className}`.trim()}>
      {children}
    </Tag>
  );
}
