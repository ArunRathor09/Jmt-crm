"use client";

import { useState } from "react";

export type LeadDateRange = "today" | "yesterday" | "last7days" | "thisMonth" | "custom";
type SelectedLeadDateRange = LeadDateRange | "";

export function LeadDateFilter({
  selectedRange,
  fromDate,
  toDate,
}: {
  selectedRange: SelectedLeadDateRange;
  fromDate: string;
  toDate: string;
}) {
  const [range, setRange] = useState(selectedRange);

  return (
    <>
      <select
        name="dateRange"
        value={range}
        onChange={(event) => {
          const value = event.target.value;
          if (
            value === "" ||
            value === "today" ||
            value === "yesterday" ||
            value === "last7days" ||
            value === "thisMonth" ||
            value === "custom"
          ) {
            setRange(value);
          }
        }}
        className="h-10 min-w-0 rounded-lg border bg-background px-3 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Filter leads by date"
      >
        <option value="">All dates</option>
        <option value="today">Today</option>
        <option value="yesterday">Yesterday</option>
        <option value="last7days">Last 7 days</option>
        <option value="thisMonth">This month</option>
        <option value="custom">Custom dates</option>
      </select>
      {range === "custom" && (
        <div className="col-span-2 grid min-w-0 grid-cols-2 gap-2">
          <label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border bg-background px-3 text-xs font-medium text-muted-foreground shadow-sm">
            From
            <input
              type="date"
              name="fromDate"
              defaultValue={fromDate}
              aria-label="From date"
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground focus-visible:outline-none"
            />
          </label>
          <label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border bg-background px-3 text-xs font-medium text-muted-foreground shadow-sm">
            To
            <input
              type="date"
              name="toDate"
              defaultValue={toDate}
              aria-label="To date"
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground focus-visible:outline-none"
            />
          </label>
        </div>
      )}
    </>
  );
}
