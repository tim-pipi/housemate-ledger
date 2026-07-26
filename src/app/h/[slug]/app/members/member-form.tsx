"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { saveMember, type FormState } from "./actions";
import { MEMBER_COLORS } from "@/lib/constants";

type Member = {
  id: number;
  username: string;
  color: string;
  passwordHash: string | null;
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

export function MemberForm({ slug, member }: { slug: string; member: Member }) {
  const router = useRouter();
  const [state, formAction] = useFormState<FormState, FormData>(saveMember, undefined);
  const [selectedColor, setSelectedColor] = useState(member.color);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="memberId" value={member.id} />

      <label className="flex flex-col gap-1 text-sm font-medium">
        Username
        <input name="username" defaultValue={member.username} maxLength={30} required />
      </label>

      <fieldset>
        <legend className="text-sm font-medium">Color</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {MEMBER_COLORS.map((c) => (
            <label key={c} className="cursor-pointer">
              <input
                type="radio"
                name="color"
                value={c}
                checked={c === selectedColor}
                onChange={() => setSelectedColor(c)}
                className="sr-only"
              />
              <span
                className="block h-8 w-8 rounded-full transition-all"
                style={{
                  background: c,
                  outline: c === selectedColor ? `3px solid ${c}` : "none",
                  outlineOffset: "3px",
                }}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm font-medium">
        New password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder={
            member.passwordHash ? "Leave blank to keep current" : "Leave blank for no password"
          }
        />
      </label>

      {member.passwordHash && (
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="clearPassword" className="h-4 w-4 accent-[#0E7C6B]" />
          Remove password (allow login without a password)
        </label>
      )}

      {state?.error && <p className="text-sm text-danger">{state.error}</p>}

      <div className="flex items-center gap-3">
        <Submit />
        <button type="button" className="btn-ghost" onClick={() => router.back()}>
          Cancel
        </button>
      </div>
    </form>
  );
}
