"use client";

import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
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
    <details id="csv-import" open className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <summary className="cursor-pointer list-none border-b bg-muted/20 px-5 py-5 [&::-webkit-details-marker]:hidden sm:px-7">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileSpreadsheet className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold tracking-tight">Import leads from CSV</span>
            <span className="mt-1 block text-sm font-normal text-muted-foreground">
              Upload a Meta export or spreadsheet file.
            </span>
          </span>
          <span className="hidden rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground sm:inline-flex">
            Up to 500 leads
          </span>
        </div>
      </summary>
      <form action={formAction} className="space-y-5 px-5 py-5 sm:px-7">
        <input type="hidden" name="market" value={market} />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)]">
          <label className="flex min-h-32 cursor-pointer flex-col justify-center rounded-xl border border-dashed bg-muted/10 p-4 transition-colors hover:border-primary/50 hover:bg-primary/[0.03]">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Upload className="h-4 w-4 text-primary" />
              Choose a CSV or TSV file
            </span>
            <span className="mt-1 text-xs text-muted-foreground">
              Maximum file size: 512 KB
            </span>
            <input
              type="file"
              name="file"
              accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
              required
              className="mt-3 block max-w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border file:bg-background file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
            />
          </label>
          <div className="flex flex-col justify-between gap-4 rounded-xl border bg-card p-4">
            <label className="grid gap-2 text-sm font-medium">
              Default package
              <span className="text-xs font-normal text-muted-foreground">
                Used only when a row has no Package column.
              </span>
              <select
                name="defaultPackageId"
                defaultValue=""
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">No default package</option>
                {packages.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — ₹{item.price.toLocaleString("en-IN")}
                  </option>
                ))}
              </select>
            </label>
            <a
              href="/templates/leads-import-template.csv"
              download
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <Download className="h-4 w-4" />
              Download CSV template
            </a>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Meta lead exports (CSV or tab-separated) are supported. Name/Full Name and
          Phone/Phone Number are required; all other columns are saved in the lead details.
          Packages are matched within the selected {market.toLowerCase()} category.
        </p>
        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            {pending ? "Importing leads..." : "Start import"}
          </button>
          {state.error && (
            <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {state.error}
            </p>
          )}
          {state.imported > 0 && (
            <p role="status" className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Imported {state.imported} leads; skipped {state.skipped}.
            </p>
          )}
        </div>
        {state.errors.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-50/60 p-4">
            <p className="text-sm font-semibold text-amber-900">Some rows need attention</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-800">
              {state.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </details>
  );
}
