"use client";

import { useActionState } from "react";
import { CalendarClock, LoaderCircle } from "lucide-react";
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

  return (
    <form action={formAction} className="mt-2 grid min-w-[250px] grid-cols-[1fr_auto] gap-1.5">
      <input type="hidden" name="leadId" value={leadId} />
      <label className="sr-only" htmlFor={`follow-up-type-${leadId}`}>
        Follow-up type
      </label>
      <select
        id={`follow-up-type-${leadId}`}
        name="type"
        defaultValue="CALL"
        className="h-9 min-w-0 rounded-md border bg-background px-2 text-xs"
      >
        {followUpTypes.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor={`follow-up-priority-${leadId}`}>
        Follow-up priority
      </label>
      <select
        id={`follow-up-priority-${leadId}`}
        name="priority"
        defaultValue={priority}
        className="h-9 rounded-md border bg-background px-2 text-xs"
      >
        {priorities.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor={`follow-up-date-${leadId}`}>
        Follow-up date and time
      </label>
      <input
        id={`follow-up-date-${leadId}`}
        type="datetime-local"
        name="dueAt"
        required
        className="h-9 min-w-0 rounded-md border bg-background px-2 text-xs"
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CalendarClock aria-hidden="true" className="h-3.5 w-3.5" />
        )}
        {pending ? "Saving" : "Schedule"}
      </button>
      {state.error && (
        <p role="alert" className="col-span-2 text-xs text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="col-span-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          Follow-up scheduled.
        </p>
      )}
    </form>
  );
}
