"use client";

import { useMemo, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { SubmitButton } from "@/components/SubmitButton";
import { saveTemplate, deleteTemplate, type FormState } from "./actions";
import { resolveShares, type SplitConfig, type SplitMethod } from "@/lib/split";
import { CATEGORIES, fmtSGD } from "@/lib/constants";

type Member = { id: number; username: string; color: string };

const METHODS: { key: SplitMethod; label: string; hint: string }[] = [
  { key: "equal", label: "Equally", hint: "Split evenly among selected people" },
  { key: "exact", label: "Exact", hint: "Enter each person's exact amount (S$)" },
  { key: "percent", label: "%", hint: "Enter each person's percentage" },
  { key: "shares", label: "Shares", hint: "Assign share units, e.g. 2 : 1 : 1 : 1" },
  { key: "adjustment", label: "+/−", hint: "Equal split, then add or subtract S$ per person" },
];

export function RecurringForm({
  slug,
  members,
  meId,
  initial,
}: {
  slug: string;
  members: Member[];
  meId: number;
  initial?: {
    templateId: number;
    description: string;
    amount: number;
    category: string;
    dayOfMonth: number;
    payer: number;
    active: boolean;
    splitMethod: SplitMethod;
    values: Record<number, number>;
    participants: number[];
  };
}) {
  const router = useRouter();
  const [state, formAction] = useFormState<FormState, FormData>(saveTemplate, undefined);
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [payer, setPayer] = useState<number>(initial?.payer ?? meId);
  const [method, setMethod] = useState<SplitMethod>(initial?.splitMethod ?? "adjustment");
  const [participants, setParticipants] = useState<number[]>(
    initial?.participants ?? members.map((m) => m.id)
  );
  const [values, setValues] = useState<Record<number, string>>(
    Object.fromEntries(
      members.map((m) => [m.id, initial?.values[m.id] != null ? String(initial.values[m.id]) : ""])
    )
  );

  const toggle = (id: number) =>
    setParticipants((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const preview = useMemo(() => {
    const cents = Math.round(Number(amount) * 100);
    if (!isFinite(cents) || cents <= 0) return { error: null, shares: null };
    try {
      const num = (id: number) => Number(values[id] || 0);
      let config: SplitConfig;
      switch (method) {
        case "equal":
          config = { method, participants };
          break;
        case "exact":
          config = {
            method,
            amounts: Object.fromEntries(
              participants.filter((id) => num(id) > 0).map((id) => [id, Math.round(num(id) * 100)])
            ),
          };
          break;
        case "percent":
          config = {
            method,
            percents: Object.fromEntries(
              participants.filter((id) => num(id) > 0).map((id) => [id, num(id)])
            ),
          };
          break;
        case "shares":
          config = {
            method,
            shares: Object.fromEntries(
              participants.filter((id) => num(id) > 0).map((id) => [id, num(id)])
            ),
          };
          break;
        case "adjustment":
          config = {
            method,
            participants,
            adjustments: Object.fromEntries(
              participants.filter((id) => num(id) !== 0).map((id) => [id, Math.round(num(id) * 100)])
            ),
          };
          break;
      }
      return { error: null, shares: resolveShares(cents, config, payer) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Invalid split", shares: null };
    }
  }, [amount, method, participants, values, payer]);

  const showValueInputs = method !== "equal";
  const unit = method === "percent" ? "%" : method === "shares" ? "shares" : "S$";

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      {initial && <input type="hidden" name="templateId" value={initial.templateId} />}
      <input type="hidden" name="splitMethod" value={method} />

      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 flex flex-col gap-1 text-sm font-medium">
          Description
          <input
            name="description"
            defaultValue={initial?.description}
            placeholder="e.g. Rent"
            required
            maxLength={120}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Amount (S$)
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Posts on day
          <input
            name="dayOfMonth"
            type="number"
            min="1"
            max="31"
            defaultValue={initial?.dayOfMonth ?? 1}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Category
          <select name="category" defaultValue={initial?.category ?? "Rent"}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Paid by
          <select name="payer" value={payer} onChange={(e) => setPayer(Number(e.target.value))}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.username}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Split</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {METHODS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMethod(m.key)}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                method === m.key
                  ? "border-accent bg-accentsoft text-accentdark"
                  : "border-line bg-white hover:border-accent"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-inkmuted">
          {METHODS.find((m) => m.key === method)?.hint}
        </p>

        <ul className="mt-3 space-y-2">
          {members.map((m) => {
            const active = participants.includes(m.id);
            return (
              <li key={m.id} className="flex items-center gap-3">
                <label className="flex w-32 items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    name={`p_${m.id}`}
                    checked={active}
                    onChange={() => toggle(m.id)}
                    className="h-4 w-4 accent-[#0E7C6B]"
                  />
                  <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
                  <span className="truncate">{m.username}</span>
                </label>
                {showValueInputs && active && (
                  <span className="flex items-center gap-1.5 text-sm text-inkmuted">
                    <input
                      name={`v_${m.id}`}
                      type="number"
                      step={method === "shares" ? "1" : "0.01"}
                      inputMode="decimal"
                      value={values[m.id] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [m.id]: e.target.value }))}
                      className="w-24 py-1.5"
                      placeholder={method === "adjustment" ? "±0.00" : "0"}
                    />
                    {unit}
                  </span>
                )}
                <span className="tnum ml-auto text-sm font-medium text-inkmuted">
                  {preview.shares && preview.shares[m.id] != null
                    ? fmtSGD(preview.shares[m.id])
                    : active
                    ? "—"
                    : ""}
                </span>
              </li>
            );
          })}
        </ul>
        {preview.error && amount && <p className="mt-2 text-sm text-danger">{preview.error}</p>}
      </fieldset>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="active"
          defaultChecked={initial?.active ?? true}
          className="h-4 w-4 accent-[#0E7C6B]"
        />
        Active (posts automatically each month)
      </label>

      {state?.error && <p className="text-sm text-danger">{state.error}</p>}

      <div className="flex items-center gap-3">
        <SubmitButton className="btn-primary" pendingLabel="Saving…">
          {initial ? "Save template" : "Create template"}
        </SubmitButton>
        <button type="button" className="btn-ghost" onClick={() => router.back()}>
          Cancel
        </button>
        {initial && (
          <SubmitButton
            formAction={deleteTemplate}
            formNoValidate
            className="btn-danger ml-auto"
            pendingLabel="Deleting…"
            onClick={(e) => {
              if (!confirm("Delete this template? Already-posted expenses stay in the ledger."))
                e.preventDefault();
            }}
          >
            Delete
          </SubmitButton>
        )}
      </div>
    </form>
  );
}
