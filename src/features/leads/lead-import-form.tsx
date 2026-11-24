"use client";

import { useActionState } from "react";
import { importLeadsAction, type LeadImportState } from "./actions";

const initialState: LeadImportState = {
  error: null,
  imported: 0,
  skipped: 0,
  errors: [],
};

export function LeadImportForm() {
  const [state, formAction, pending] = useActionState(importLeadsAction, initialState);

  return (
    <details className="rounded-xl border bg-card shadow-sm">
      <summary className="cursor-pointer list-none px-5 py-4 font-semibold">
        Import leads from CSV
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          (up to 500 leads per file)
        </span>
      </summary>
      <form action={formAction} className="space-y-4 border-t px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="block max-w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border file:bg-background file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
          />
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
          Required columns: Name, Phone. Optional columns: Email, Company, Description, Package,
          Price, Source, Priority, Next Follow-up. Package and source names must already exist.
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
