import Link from "next/link";

export function PageHeader({
  backHref,
  backLabel = "← Back to dashboard",
  title,
  description,
  action,
}: {
  backHref: string;
  backLabel?: string;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div>
      <Link href={backHref} className="text-sm text-inkmuted hover:underline">
        {backLabel}
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        {action}
      </div>
      {description && <p className="mt-1 text-sm text-inkmuted">{description}</p>}
    </div>
  );
}
