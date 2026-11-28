"use client";

import { useState } from "react";
import { useActionState } from "react";
import { CalendarClock, LoaderCircle, Plus, X } from "lucide-react";
import {
  scheduleLeadFollowUpAction,
  type FollowUpScheduleState,
} from "./actions";

const initialState: FollowUpScheduleState = {
  error: null,
  success: false,
};

const followUpTypes = [
  { value: "CALL", label: "Call" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "EMAIL", label: "Email" },
  { value: "MEETING", label: "Meeting" },
  { value: "TASK", label: "Task" },
];

const priorities = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "HOT", label: "Hot" },
];

export function LeadFollowUpForm({
  leadId,
  priority,
}: {
  leadId: string;
  priority: (typeof priorities)[number]["value"];
}) {
  const [state, formAction, pending] = useActionState(
    scheduleLeadFollowUpAction,
    initialState,
  );
  const [slotIds, setSlotIds] = useState([0]);
  const [nextSlotId, setNextSlotId] = useState(1);

  return (
    <form action={formAction} className="mt-3 space-y-4">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
          Contact method
          <select
            name="type"
            defaultValue="CALL"
            className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground"
          >
            {followUpTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
          Priority
          <select
            name="priority"
            defaultValue={priority}
            className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground"
          >
            {priorities.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="rounded-xl border bg-muted/20 p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold">Schedule time slots</h4>
            <p className="text-xs text-muted-foreground">
              Add multiple calls or reminders for this lead.
            </p>
          </div>
          <button
            type="button"
            disabled={slotIds.length >= 20}
            onClick={() => {
              setSlotIds((current) => [...current, nextSlotId]);
              setNextSlotId((current) => current + 1);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-background px-3 text-xs font-semibold transition-colors hover:border-primary/40 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            Add time
          </button>
        </div>
        <div className="space-y-2">
          {slotIds.map((slotId, index) => (
            <div key={slotId} className="flex items-center gap-2">
              <label className="sr-only" htmlFor={`follow-up-date-${leadId}-${slotId}`}>
                Follow-up time {index + 1}
              </label>
              <input
                id={`follow-up-date-${leadId}-${slotId}`}
                type="datetime-local"
                name="dueAt"
                required
                className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm"
              />
              {slotIds.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remove time slot ${index + 1}`}
                  onClick={() =>
                    setSlotIds((current) => current.filter((id) => id !== slotId))
                  }
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
        Notes shared by all slots
        <textarea
          name="notes"
          rows={3}
          maxLength={2000}
          placeholder="Add useful context for these follow-ups"
          className="min-h-20 resize-y rounded-lg border bg-background px-3 py-2 text-sm font-normal text-foreground"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
        ) : (
          <CalendarClock aria-hidden="true" className="h-4 w-4" />
        )}
        {pending ? "Scheduling..." : `Schedule ${slotIds.length} ${slotIds.length === 1 ? "follow-up" : "follow-ups"}`}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          {slotIds.length === 1 ? "Follow-up scheduled." : "Follow-ups scheduled."}
        </p>
      )}
    </form>
  );
}
