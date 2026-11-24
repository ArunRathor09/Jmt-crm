"use client";

import { useActionState } from "react";
import { importLeadsAction, type LeadImportState } from "./actions";

const initialState: LeadImportState = {
  error: null,
  imported: 0,
  skipped: 0,
  errors: [],
};

export function LeadImportForm({
  market,
  packages,
}: {
  market: "DOMESTIC" | "INTERNATIONAL";
  packages: { id: string; name: string; price: number }[];
}) {
  const [state, formAction, pending] = useActionState(importLeadsAction, initialState);

  return (
    <details id="csv-import" open className="rounded-xl border bg-card shadow-sm">
      <summary className="cursor-pointer list-none px-5 py-4 font-semibold">
        Import leads from CSV
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          (up to 500 leads per file)
        </span>
      </summary>
      <form action={formAction} className="space-y-4 border-t px-5 py-4">
        <input type="hidden" name="market" value={market} />
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            name="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
            required
            className="block max-w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border file:bg-background file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
          />
          <label className="flex h-10 items-center gap-2 rounded-lg border px-3 text-sm">
            Package for rows without a Package column
            <select name="defaultPackageId" defaultValue="" className="max-w-40 bg-transparent">
              <option value="">None</option>
              {packages.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — ₹{item.price.toLocaleString("en-IN")}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-lg border px-4 text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Importing..." : "Import CSV"}
          </button>
          <a
            href="/templates/leads-import-template.csv"
            download
            className="text-sm font-medium text-primary hover:underline"
          >
            Download CSV template
          </a>
        </div>
        <p className="text-xs text-muted-foreground">
          Meta lead exports (CSV or tab-separated) are supported. Name/Full Name and
          Phone/Phone Number are required; all other columns are saved in the lead details.
          Packages are matched within the selected {market.toLowerCase()} category.
        </p>
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        {state.imported > 0 && (
          <p role="status" className="text-sm text-emerald-700">
            Imported {state.imported} leads; skipped {state.skipped}.
          </p>
        )}
        {state.errors.length > 0 && (
          <ul className="list-inside list-disc space-y-1 text-sm text-amber-700">
            {state.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
      </form>
    </details>
  );
}
