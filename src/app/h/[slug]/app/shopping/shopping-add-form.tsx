"use client";

import { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { addItem, type FormState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary shrink-0" disabled={pending}>
      {pending ? "Adding…" : "Add"}
    </button>
  );
}

export function ShoppingAddForm({ slug }: { slug: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState<FormState, FormData>(addItem, undefined);

  return (
    <form
      ref={formRef}
      action={(formData) => {
        formAction(formData);
        formRef.current?.reset();
      }}
      className="mt-4 flex flex-col gap-2 sm:flex-row"
    >
      <input type="hidden" name="slug" value={slug} />
      <input
        name="name"
        placeholder="Item, e.g. Dish soap"
        required
        maxLength={120}
        className="flex-1"
      />
      <input
        name="note"
        placeholder="Note (optional)"
        maxLength={120}
        className="flex-1"
      />
      <Submit />
      {state?.error && <p className="text-sm text-danger sm:basis-full">{state.error}</p>}
    </form>
  );
}
