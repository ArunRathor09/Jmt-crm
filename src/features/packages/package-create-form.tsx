"use client";

import { CalendarDays, CheckCircle2, Compass, PackagePlus, Sparkles } from "lucide-react";
import { useActionState, useState } from "react";
import { createPackageAction, type PackageActionState } from "./actions";

const initialState: PackageActionState = { error: null, success: false };
const fieldClassName =
  "h-11 w-full rounded-lg border bg-background px-3 text-sm font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-ring";

export function PackageCreateForm() {
  const [state, formAction, pending] = useActionState(createPackageAction, initialState);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"DOMESTIC" | "INTERNATIONAL">("DOMESTIC");
  const [price, setPrice] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const displayPrice = Number(price);

  return (
    <form action={formAction} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="border-b bg-gradient-to-r from-accent/60 to-card px-5 py-5 sm:px-7">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <PackagePlus aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold tracking-tight">Create a travel package</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Set the destination, pricing, and details that your team can use on leads.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="grid content-start gap-5 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">
            Package name <span className="text-destructive">*</span>
            <input
              name="name"
              required
              maxLength={150}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={fieldClassName}
              placeholder="e.g. Goa beach escape"
              autoComplete="off"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Department <span className="text-destructive">*</span>
            <select
              name="category"
              required
              value={category}
              onChange={(event) =>
                setCategory(event.target.value === "INTERNATIONAL" ? "INTERNATIONAL" : "DOMESTIC")
              }
              className={fieldClassName}
            >
              <option value="DOMESTIC">Domestic</option>
              <option value="INTERNATIONAL">International</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Starting price (INR) <span className="text-destructive">*</span>
            <input
              name="price"
              type="number"
              required
              min={0}
              step={1}
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className={fieldClassName}
              placeholder="e.g. 25000"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Duration
            <span className="relative">
              <input
                name="durationDays"
                type="number"
                min={1}
                max={3650}
                step={1}
                value={durationDays}
                onChange={(event) => setDurationDays(event.target.value)}
                className={`${fieldClassName} pr-16`}
                placeholder="Optional"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-normal text-muted-foreground">
                days
              </span>
            </span>
          </label>
          <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
            Package description
            <textarea
              name="description"
              rows={4}
              maxLength={5000}
              className="w-full resize-y rounded-lg border bg-background px-3 py-2.5 text-sm font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-ring"
              placeholder="Share highlights, inclusions, and what makes this trip special."
            />
            <span className="text-xs font-normal text-muted-foreground">
              Optional · Up to 5,000 characters
            </span>
          </label>
        </div>

        <aside className="rounded-2xl border bg-gradient-to-br from-primary/[0.07] via-card to-accent/30 p-5">
          <div className="flex items-center justify-between">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-background text-primary shadow-sm">
              <Compass aria-hidden="true" className="h-5 w-5" />
            </span>
            <span className="rounded-full border bg-background/80 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
              {category === "DOMESTIC" ? "Domestic" : "International"}
            </span>
          </div>
          <p className="mt-6 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Package preview
          </p>
          <p className="mt-1 break-words text-lg font-semibold tracking-tight">
            {name.trim() || "Your new package"}
          </p>
          <p className="mt-4 text-xs text-muted-foreground">Starting from</p>
          <p className="mt-0.5 text-2xl font-bold tracking-tight">
            {Number.isFinite(displayPrice) && price !== ""
              ? `₹${displayPrice.toLocaleString("en-IN")}`
              : "₹—"}
          </p>
          <div className="mt-5 flex items-center gap-2 border-t pt-4 text-sm text-muted-foreground">
            {durationDays ? (
              <>
                <CalendarDays aria-hidden="true" className="h-4 w-4 text-primary" />
                {durationDays} {durationDays === "1" ? "day" : "days"}
              </>
            ) : (
              <>
                <Sparkles aria-hidden="true" className="h-4 w-4 text-primary" />
                Flexible duration
              </>
            )}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Active packages appear in the matching department when adding or editing a lead.
          </p>
        </aside>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t bg-muted/10 px-5 py-4 sm:px-7">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state.success ? <CheckCircle2 className="h-4 w-4" /> : <PackagePlus className="h-4 w-4" />}
          {pending ? "Adding package..." : state.success ? "Package added" : "Add package"}
        </button>
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="text-sm text-emerald-700">
            Package added and ready to use on leads.
          </p>
        )}
      </div>
    </form>
  );
}
