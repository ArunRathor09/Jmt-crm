"use client";

import { useActionState } from "react";
import { createLeadAction, type LeadActionState } from "./actions";

const initialState: LeadActionState = { error: null, success: false };

const fieldClassName =
  "h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring";

export function LeadCreateForm({
  market,
  sources,
  packages,
}: {
  market: "DOMESTIC" | "INTERNATIONAL";
  sources: { id: string; name: string }[];
  packages: { id: string; name: string; price: number }[];
}) {
  const [state, formAction, pending] = useActionState(createLeadAction, initialState);

  return (
    <form action={formAction} className="rounded-xl border bg-card p-5 shadow-sm">
      <input type="hidden" name="market" value={market} />
      <h2 className="font-semibold">Add a {market === "DOMESTIC" ? "domestic" : "international"} lead</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-2 text-sm font-medium">
          Name <span className="text-destructive">*</span>
          <input name="name" required maxLength={150} className={fieldClassName} placeholder="Lead name" />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Calling number <span className="text-destructive">*</span>
          <input name="phone" type="tel" required minLength={7} maxLength={20} className={fieldClassName} placeholder="+91 98765 43210" />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Email
          <input name="email" type="email" maxLength={255} className={fieldClassName} placeholder="Email address" />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Company
          <input name="company" maxLength={150} className={fieldClassName} placeholder="Company name" />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Interested package
          <select name="packageId" defaultValue="" className={fieldClassName}>
            <option value="">Select a package</option>
            {packages.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} — ₹{item.price.toLocaleString("en-IN")}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          Price (₹)
          <input name="budget" type="number" min={0} step={1} className={fieldClassName} placeholder="Defaults to package price" />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Lead source
          <select name="sourceId" defaultValue="" className={fieldClassName}>
            <option value="">Select a source</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          Priority
          <select name="priority" defaultValue="MEDIUM" className={fieldClassName}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="HOT">Hot</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium sm:col-span-2 xl:col-span-4">
          Description
          <textarea
            name="description"
            rows={3}
            maxLength={5000}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-ring"
            placeholder="Customer requirements, call notes, or package details"
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Next follow-up (IST)
          <input name="nextFollowUpAt" type="datetime-local" className={fieldClassName} />
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
