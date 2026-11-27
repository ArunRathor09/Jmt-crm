"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { Download, LoaderCircle, Trash2 } from "lucide-react";
import { bulkDeleteLeadsAction } from "./actions";

export type LeadExportRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  city: string | null;
  market: string;
  category: string | null;
  status: string;
  priority: string;
  assignedToName: string | null;
  createdAt: string;
};

type SelectionContextValue = {
  leadIds: string[];
  rows: LeadExportRow[];
  selectedIds: string[];
  canDelete: boolean;
  canExport: boolean;
  setSelectedIds: (ids: string[]) => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

function useLeadSelection() {
  const context = useContext(SelectionContext);
  if (!context) throw new Error("Lead selection controls must be inside their provider.");
  return context;
}

export function LeadBulkSelectionProvider({
  leadIds,
  rows,
  canDelete,
  canExport,
  children,
}: {
  leadIds: string[];
  rows: LeadExportRow[];
  canDelete: boolean;
  canExport: boolean;
  children: ReactNode;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  return (
    <SelectionContext.Provider
      value={{ leadIds, rows, selectedIds, canDelete, canExport, setSelectedIds }}
    >
      {children}
    </SelectionContext.Provider>
  );
}

export function LeadRowCheckbox({ leadId, leadName }: { leadId: string; leadName: string }) {
  const { selectedIds, setSelectedIds } = useLeadSelection();
  const checked = selectedIds.includes(leadId);

  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={() =>
        setSelectedIds(
          checked ? selectedIds.filter((id) => id !== leadId) : [...selectedIds, leadId],
        )
      }
      aria-label={`Select ${leadName}`}
      className="h-4 w-4 cursor-pointer rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

export function LeadSelectAllCheckbox() {
  const { leadIds, selectedIds, setSelectedIds } = useLeadSelection();
  const checkboxRef = useRef<HTMLInputElement>(null);
  const allSelected = leadIds.length > 0 && leadIds.every((id) => selectedIds.includes(id));
  const someSelected = leadIds.some((id) => selectedIds.includes(id));

  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = someSelected && !allSelected;
  }, [allSelected, someSelected]);

  return (
    <input
      ref={checkboxRef}
      type="checkbox"
      checked={allSelected}
      onChange={() =>
        setSelectedIds(
          allSelected
            ? selectedIds.filter((id) => !leadIds.includes(id))
            : [...new Set([...selectedIds, ...leadIds])],
        )
      }
      aria-label="Select all leads on this page"
      className="h-4 w-4 cursor-pointer rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

function csvCell(value: string | null) {
  const safeValue = value ?? "";
  const protectedValue = /^[\t\r\n ]*[=+\-@]/.test(safeValue) ? `'${safeValue}` : safeValue;
  return `"${protectedValue.replaceAll('"', '""')}"`;
}

export function LeadBulkActions() {
  const { rows, selectedIds, canDelete, canExport, setSelectedIds } = useLeadSelection();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selectedRows = rows.filter((row) => selectedIds.includes(row.id));

  const exportSelected = () => {
    if (selectedRows.length === 0) return;

    const columns: { label: string; key: keyof LeadExportRow }[] = [
      { label: "Lead name", key: "name" },
      { label: "Phone", key: "phone" },
      { label: "Email", key: "email" },
      { label: "Company", key: "company" },
      { label: "City", key: "city" },
      { label: "Department", key: "market" },
      { label: "Category", key: "category" },
      { label: "Status", key: "status" },
      { label: "Priority", key: "priority" },
      { label: "Assigned to", key: "assignedToName" },
      { label: "Created", key: "createdAt" },
    ];
    const content = [
      columns.map(({ label }) => csvCell(label)).join(","),
      ...selectedRows.map((row) =>
        columns.map(({ key }) => csvCell(row[key])).join(","),
      ),
    ].join("\r\n");
    const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    setMessage(`Exported ${selectedRows.length} selected leads.`);
    setError("");
  };

  const deleteSelected = () => {
    if (selectedIds.length === 0 || pending) return;
    if (
      !window.confirm(
        `Permanently delete ${selectedIds.length} selected ${
          selectedIds.length === 1 ? "lead" : "leads"
        }? Their lead history will also be removed.`,
      )
    ) {
      return;
    }

    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await bulkDeleteLeadsAction(selectedIds);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSelectedIds([]);
      setMessage(
        result.deleted < selectedIds.length
          ? `Permanently deleted ${result.deleted} of ${selectedIds.length} selected leads.`
          : `Permanently deleted ${result.deleted} ${
              result.deleted === 1 ? "lead" : "leads"
            }.`,
      );
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {error ? (
          <span className="text-destructive">{error}</span>
        ) : (
          message ||
          (selectedIds.length > 0 ? `${selectedIds.length} selected` : null)
        )}
      </p>
      {canExport && (
        <button
          type="button"
          onClick={exportSelected}
          disabled={selectedIds.length === 0}
          className="inline-flex h-10 items-center gap-2 rounded-xl border bg-card px-3 text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Download aria-hidden="true" className="h-3.5 w-3.5" />
          Export selected
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={deleteSelected}
          disabled={selectedIds.length === 0 || pending}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-destructive px-3 text-sm font-semibold text-white transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {pending ? (
            <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          )}
          {pending ? "Deleting..." : "Delete selected"}
        </button>
      )}
    </div>
  );
}
