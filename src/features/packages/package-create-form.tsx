"use client";

import { useActionState } from "react";
import { createPackageAction, type PackageActionState } from "./actions";

const initialState: PackageActionState = { error: null, success: false };
const fieldClassName =
  "h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring";

export function PackageCreateForm() {
  const [state, formAction, pending] = useActionState(createPackageAction, initialState);

  return (
    <form action={formAction} className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="font-semibold">Add a package</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Packages created here appear in the matching Leads category.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-2 text-sm font-medium">
          Package name
          <input
            name="name"
            required
            maxLength={150}
            className={fieldClassName}
            placeholder="e.g. Goa"
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Category
          <select name="category" required defaultValue="DOMESTIC" className={fieldClassName}>
            <option value="DOMESTIC">Domestic</option>
            <option value="INTERNATIONAL">International</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          Price (INR)
          <input
            name="price"
            type="number"
            required
            min={0}
            step={1}
            className={fieldClassName}
            placeholder="0"
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Duration (days)
          <input
            name="durationDays"
            type="number"
            min={1}
            max={3650}
            step={1}
            className={fieldClassName}
            placeholder="Optional"
          />
        </label>
        <label className="space-y-2 text-sm font-medium sm:col-span-2 xl:col-span-4">
          Description
          <textarea
            name="description"
            rows={3}
            maxLength={5000}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-ring"
            placeholder="What's included in this package?"
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Adding package..." : "Add package"}
        </button>
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="text-sm text-emerald-700">
            Package added.
          </p>
        )}
      </div>
    </form>
  );
}
