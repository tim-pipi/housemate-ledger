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
