"use client";

import { Archive, ArchiveRestore, LoaderCircle, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deletePackageAction, updatePackageStatusAction } from "./actions";

export function PackageRowActions({
  packageId,
  packageName,
  status,
}: {
  packageId: string;
  packageName: string;
  status: "ACTIVE" | "ARCHIVED";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const updateStatus = () => {
    setError("");
    startTransition(async () => {
      const nextStatus = status === "ACTIVE" ? "ARCHIVED" : "ACTIVE";
      const result = await updatePackageStatusAction(packageId, nextStatus);
      if (result.error) setError(result.error);
    });
  };

  const deletePackage = () => {
    if (
      !window.confirm(
        `Delete "${packageName}" from the package catalog? Existing lead and customer history will be preserved.`,
      )
    ) {
      return;
    }

    setError("");
    startTransition(async () => {
      const result = await deletePackageAction(packageId);
      if (result.error) setError(result.error);
    });
  };

  return (
    <div className="flex min-w-44 flex-col items-end gap-1.5">
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={updateStatus}
          disabled={pending}
          aria-label={`${status === "ACTIVE" ? "Deactivate" : "Activate"} ${packageName}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-xs font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? (
            <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
          ) : status === "ACTIVE" ? (
            <Archive aria-hidden="true" className="h-3.5 w-3.5" />
          ) : (
            <ArchiveRestore aria-hidden="true" className="h-3.5 w-3.5" />
          )}
          {status === "ACTIVE" ? "Deactivate" : "Activate"}
        </button>
        <button
          type="button"
          onClick={deletePackage}
          disabled={pending}
          aria-label={`Delete ${packageName}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-destructive/30 bg-background px-2.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>
      {error && (
        <p role="alert" className="max-w-56 text-right text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
