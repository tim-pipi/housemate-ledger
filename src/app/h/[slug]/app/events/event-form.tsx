"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { SubmitButton } from "@/components/SubmitButton";
import { saveEvent, deleteEvent, type FormState } from "./actions";
import type { Recurrence } from "@/lib/events";

const FREQ_OPTIONS: { key: Recurrence["freq"]; label: string }[] = [
  { key: "none", label: "Once" },
  { key: "monthly", label: "Monthly" },
  { key: "months", label: "Every N months" },
  { key: "yearly", label: "Yearly" },
];

export function EventForm({
  slug,
  initial,
  defaultDate,
}: {
  slug: string;
  initial?: {
    eventId: number;
    title: string;
    note: string;
    nextDate: string;
    startTime: string | null;
    endTime: string | null;
    remindDaysBefore: number;
    active: boolean;
    recurrence: Recurrence;
  };
  defaultDate?: string;
}) {
  const router = useRouter();
  const [state, formAction] = useFormState<FormState, FormData>(saveEvent, undefined);
  const [freq, setFreq] = useState<Recurrence["freq"]>(initial?.recurrence.freq ?? "none");
  const [monthlyDay, setMonthlyDay] = useState(
    initial?.recurrence.freq === "monthly" ? initial.recurrence.day : 1
  );
  const [monthsInterval, setMonthsInterval] = useState(
    initial?.recurrence.freq === "months" ? initial.recurrence.interval : 4
  );
  const [allDay, setAllDay] = useState(!initial?.startTime);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      {initial && <input type="hidden" name="eventId" value={initial.eventId} />}
      <input type="hidden" name="freq" value={freq} />
      {freq === "monthly" && <input type="hidden" name="monthlyDay" value={monthlyDay} />}
      {freq === "months" && <input type="hidden" name="monthsInterval" value={monthsInterval} />}

      <label className="flex flex-col gap-1 text-sm font-medium">
        Title
        <input
          name="title"
          defaultValue={initial?.title}
          placeholder="e.g. Pay landlord"
          required
          maxLength={120}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Note
        <input
          name="note"
          defaultValue={initial?.note}
          placeholder="optional, e.g. rent S$3,200"
          maxLength={200}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Date
          <input name="nextDate" type="date" defaultValue={initial?.nextDate ?? defaultDate} required />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Remind days before
          <input
            name="remindDaysBefore"
            type="number"
            min="0"
            defaultValue={initial?.remindDaysBefore ?? 1}
            required
          />
        </label>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="allDay"
            defaultChecked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="h-4 w-4 accent-[#0E7C6B]"
          />
          All day
        </label>
        {!allDay && (
          <div className="mt-2 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Start time
              <input name="startTime" type="time" defaultValue={initial?.startTime ?? ""} required={!allDay} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              End time (optional)
              <input name="endTime" type="time" defaultValue={initial?.endTime ?? ""} />
            </label>
          </div>
        )}
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Repeats</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {FREQ_OPTIONS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFreq(f.key)}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                freq === f.key
                  ? "border-accent bg-accentsoft text-accentdark"
                  : "border-line bg-white hover:border-accent"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {freq === "monthly" && (
          <label className="mt-2 flex items-center gap-2 text-sm">
            Day of month
            <input
              type="number"
              min="1"
              max="31"
              value={monthlyDay}
              onChange={(e) => setMonthlyDay(Number(e.target.value))}
              className="w-20"
            />
          </label>
        )}
        {freq === "months" && (
          <label className="mt-2 flex items-center gap-2 text-sm">
            Every
            <input
              type="number"
              min="1"
              value={monthsInterval}
              onChange={(e) => setMonthsInterval(Number(e.target.value))}
              className="w-20"
            />
            months
          </label>
        )}
      </fieldset>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="active"
          defaultChecked={initial?.active ?? true}
          className="h-4 w-4 accent-[#0E7C6B]"
        />
        Active (sends reminders)
      </label>

      {state?.error && <p className="text-sm text-danger">{state.error}</p>}

      <div className="flex items-center gap-3">
        <SubmitButton className="btn-primary" pendingLabel="Saving…">
          {initial ? "Save event" : "Create event"}
        </SubmitButton>
        <button type="button" className="btn-ghost" onClick={() => router.back()}>
          Cancel
        </button>
        {initial && (
          <SubmitButton
            formAction={deleteEvent}
            formNoValidate
            className="btn-danger ml-auto"
            pendingLabel="Deleting…"
            onClick={(e) => {
              if (!confirm("Delete this event?")) e.preventDefault();
            }}
          >
            Delete
          </SubmitButton>
        )}
      </div>
    </form>
  );
}
