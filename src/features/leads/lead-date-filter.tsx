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
  const [fromDateValue, setFromDateValue] = useState(fromDate);
  const [toDateValue, setToDateValue] = useState(toDate);

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
        className="h-10 w-[145px] shrink-0 rounded-lg border bg-card px-3 text-sm shadow-sm transition hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        <div className="flex w-full min-w-[240px] max-w-[280px] flex-[1_1_280px] items-center gap-2">
          <label className="flex h-10 min-w-0 flex-1 items-center gap-1.5 rounded-lg border bg-background px-2 text-xs font-medium text-muted-foreground shadow-sm">
            From
            <input
              type="date"
              name="fromDate"
              value={fromDateValue}
              max={toDateValue || undefined}
              onChange={(event) => setFromDateValue(event.target.value)}
              aria-label="From date"
              className="w-full min-w-0 bg-transparent text-sm text-foreground focus-visible:outline-none"
            />
          </label>
          <label className="flex h-10 min-w-0 flex-1 items-center gap-1.5 rounded-lg border bg-background px-2 text-xs font-medium text-muted-foreground shadow-sm">
            To
            <input
              type="date"
              name="toDate"
              value={toDateValue}
              min={fromDateValue || undefined}
              onChange={(event) => setToDateValue(event.target.value)}
              aria-label="To date"
              className="w-full min-w-0 bg-transparent text-sm text-foreground focus-visible:outline-none"
            />
          </label>
        </div>
      )}
    </>
  );
}
