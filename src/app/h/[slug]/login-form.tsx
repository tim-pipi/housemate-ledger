"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { loginOrJoin, type LoginState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary mt-2" disabled={pending}>
      {pending ? "Entering…" : "Enter house"}
    </button>
  );
}

export function LoginForm({
  slug,
  existing,
}: {
  slug: string;
  existing: { username: string; color: string; locked: boolean }[];
}) {
  const [state, formAction] = useFormState<LoginState, FormData>(loginOrJoin, undefined);
  const [username, setUsername] = useState("");

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      {existing.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {existing.map((m) => (
            <button
              key={m.username}
              type="button"
              onClick={() => setUsername(m.username)}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                username === m.username
                  ? "border-accent bg-accentsoft text-accentdark"
                  : "border-line bg-white text-ink hover:border-accent"
              }`}
            >
              <span
                className="mr-1.5 inline-block h-2 w-2 rounded-full"
                style={{ background: m.color }}
              />
              {m.username}
              {m.locked && <span className="ml-1 text-inkmuted">🔒</span>}
            </button>
          ))}
        </div>
      )}
      <label htmlFor="username" className="mt-2 text-sm font-medium">
        Username
      </label>
      <input
        id="username"
        name="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="e.g. Tim"
        required
        maxLength={30}
        autoComplete="username"
      />
      <label htmlFor="password" className="text-sm font-medium">
        Password <span className="font-normal text-inkmuted">(optional)</span>
      </label>
      <input
        id="password"
        name="password"
        type="password"
        placeholder="Set on first login, required after"
        autoComplete="current-password"
      />
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <Submit />
    </form>
  );
}
