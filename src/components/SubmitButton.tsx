"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingLabel,
  className = "btn-primary",
  name,
  value,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingLabel?: React.ReactNode }) {
  // useFormStatus() reports pending for the whole <form>, not just this
  // button — a native submit only includes the CLICKED button's name/value
  // pair in the submitted FormData, so when a form has multiple distinct
  // submit buttons (e.g. Save + Delete with different formActions), give
  // each one a `name`/`value` pair to tell which one is actually in flight.
  // Without both, this falls back to the whole-form pending state.
  const { pending, data } = useFormStatus();
  const isPending = pending && (name && value != null ? data?.get(String(name)) === String(value) : true);
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-70`}
      {...rest}
      disabled={isPending || disabled}
    >
      {isPending ? (
        <span className="inline-flex items-center gap-1.5">
          <Spinner />
          {pendingLabel ?? children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
