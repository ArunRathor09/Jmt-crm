"use client";

import { useActionState } from "react";
import { createLeadAction, type LeadActionState } from "./actions";

const initialState: LeadActionState = { error: null, success: false };

export function LeadCreateForm({
  sources,
}: {
  sources: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createLeadAction, initialState);

  return (
    <form action={formAction} className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="font-semibold">Add a lead</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <label className="space-y-2 text-sm font-medium">
          Name <span className="text-destructive">*</span>
          <input
            name="name"
            required
            maxLength={150}
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring"
            placeholder="Lead name"
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Phone <span className="text-destructive">*</span>
          <input
            name="phone"
            type="tel"
            required
            minLength={7}
            maxLength={20}
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring"
            placeholder="Phone number"
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Email
          <input
            name="email"
            type="email"
            maxLength={255}
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring"
            placeholder="Email address"
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Company
          <input
            name="company"
            maxLength={150}
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring"
            placeholder="Company name"
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Source
          <select
            name="sourceId"
            defaultValue=""
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select a source</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Adding lead..." : "Add lead"}
        </button>
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="text-sm text-emerald-700">
            Lead added.
          </p>
        )}
      </div>
    </form>
  );
}
