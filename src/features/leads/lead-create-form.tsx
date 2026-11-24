"use client";

import Link from "next/link";
import { CheckCircle2, ListChecks, Plane, Plus, UserRound } from "lucide-react";
import { useState } from "react";
import { useActionState } from "react";
import { createLeadAction, type LeadActionState } from "./actions";
import { getLeadQuestionFields } from "./source-fields";
import type { leadMarkets, leadStatusValues } from "./schemas";

type Market = (typeof leadMarkets)[number];
type Status = (typeof leadStatusValues)[number];

const initialState: LeadActionState = { error: null, success: false };
const fieldClassName =
  "h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring";
const statuses: { value: Status; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "PROPOSAL_SENT", label: "Proposal sent" },
  { value: "NEGOTIATION", label: "Negotiation" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
  { value: "JUNK", label: "Junk" },
];

export function LeadCreateForm({
  initialMarket,
  sources,
  packages,
}: {
  initialMarket: Market;
  sources: { id: string; name: string }[];
  packages: { id: string; name: string; price: number; category: string | null }[];
}) {
  const [state, formAction, pending] = useActionState(createLeadAction, initialState);
  const [market, setMarket] = useState(initialMarket);
  const [packageId, setPackageId] = useState("");
  const availablePackages = packages.filter((item) => item.category === market);
  const selectedPackage = availablePackages.find((item) => item.id === packageId);
  const questionFields = getLeadQuestionFields(selectedPackage?.name);

  return (
    <form action={formAction} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="border-b bg-muted/20 px-5 py-5 sm:px-7">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <UserRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold tracking-tight">Lead information</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add contact details, qualify the trip, and set the next action.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-7 px-5 py-6 sm:px-7">
        <section className="rounded-xl border bg-muted/15 p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <Plane className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Trip and package</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">
              Category
              <select
                name="market"
                value={market}
                onChange={(event) => {
                  setMarket(event.target.value === "INTERNATIONAL" ? "INTERNATIONAL" : "DOMESTIC");
                  setPackageId("");
                }}
                className={fieldClassName}
              >
                <option value="DOMESTIC">Domestic</option>
                <option value="INTERNATIONAL">International</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Package
              <select
                name="packageId"
                value={packageId}
                onChange={(event) => setPackageId(event.target.value)}
                className={fieldClassName}
              >
                <option value="">Select a package</option>
                {availablePackages.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — ₹{item.price.toLocaleString("en-IN")}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {selectedPackage && (
            <p className="mt-3 text-xs text-muted-foreground">
              Selected package: <span className="font-medium text-foreground">{selectedPackage.name}</span>
              <span className="mx-1.5">·</span>
              Starting at ₹{selectedPackage.price.toLocaleString("en-IN")}
            </p>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-center gap-2">
            <UserRound className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Contact details</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <label className="grid gap-1.5 text-sm font-medium">
              Full name <span className="text-destructive">*</span>
              <input name="name" required maxLength={150} className={fieldClassName} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Company / organization
              <input name="company" maxLength={150} className={fieldClassName} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Calling number <span className="text-destructive">*</span>
              <input
                name="phone"
                type="tel"
                required
                minLength={7}
                maxLength={20}
                className={fieldClassName}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              WhatsApp number
              <input name="alternatePhone" type="tel" maxLength={20} className={fieldClassName} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Email
              <input name="email" type="email" maxLength={255} className={fieldClassName} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              City
              <input name="city" maxLength={100} className={fieldClassName} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Price / budget (INR)
              <input
                name="budget"
                type="number"
                min={0}
                step={1}
                placeholder={selectedPackage ? `${selectedPackage.price}` : "Optional"}
                className={fieldClassName}
              />
            </label>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            <div>
              <h3 className="text-sm font-semibold">Qualification and follow-up</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Answers accept text or numbers.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <label className="grid gap-1.5 text-sm font-medium">
              Lead status
              <select name="status" defaultValue="NEW" className={fieldClassName}>
                {statuses.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Priority
              <select name="priority" defaultValue="MEDIUM" className={fieldClassName}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="HOT">Hot</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
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
            <label className="grid gap-1.5 text-sm font-medium">
              Next follow-up (IST)
              <input name="nextFollowUpAt" type="datetime-local" className={fieldClassName} />
            </label>
            {questionFields.map((field) => (
              <label key={field.key} className="grid gap-1.5 text-sm font-medium">
                {field.label}
                <input
                  name={field.formName}
                  type="text"
                  maxLength={2000}
                  placeholder="Enter text or a number"
                  className={fieldClassName}
                />
              </label>
            ))}
            {questionFields.length === 0 && (
              <p className="self-center text-sm text-muted-foreground sm:col-span-2 xl:col-span-3">
                Select a package to see its trip qualification questions.
              </p>
            )}
            <label className="grid gap-1.5 text-sm font-medium sm:col-span-2 xl:col-span-3">
              Description / notes
              <textarea
                name="description"
                rows={3}
                maxLength={5000}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t bg-muted/10 px-5 py-4 sm:px-7">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state.success ? <CheckCircle2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {pending ? "Adding lead..." : state.success ? "Lead added" : "Add lead"}
        </button>
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="text-sm text-emerald-700">
            Lead added.{" "}
            <Link href={`/leads?market=${market}`} className="font-medium underline">
              View pipeline
            </Link>
          </p>
        )}
      </div>
    </form>
  );
}
