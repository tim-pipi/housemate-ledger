import { createHouse } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-accent">
        Housemate Ledger
      </p>
      <h1 className="mt-3 font-display text-4xl font-bold leading-tight">
        One link for the whole flat.
      </h1>
      <p className="mt-4 text-inkmuted">
        Create a house, share the link with your housemates, and start logging
        shared expenses. No accounts, no emails — just open the link and go.
      </p>
      <form action={createHouse} className="mt-8 flex flex-col gap-3">
        <label htmlFor="name" className="text-sm font-medium">
          House name
        </label>
        <input id="name" name="name" placeholder="e.g. Tampines 4B" required maxLength={60} />
        <SubmitButton className="btn-primary mt-2" pendingLabel="Creating…">
          Create house & get link
        </SubmitButton>
      </form>
      <p className="mt-6 text-xs text-inkmuted">
        Anyone with the link can join. Keep it within your household.
      </p>
    </main>
  );
}
