"use client";

import { useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Pencil,
  Tag,
  UserRound,
  Workflow,
  X,
} from "lucide-react";
import {
  assignLeadAction,
  closeLeadQueryAction,
  createLeadQueryAction,
  updateLeadCategoryAction,
  updateLeadStatusAction,
} from "./actions";
import { formatDate } from "./format";
import { LeadFollowUpForm } from "./lead-follow-up-form";
import { leadCategories } from "./schemas";

type LeadCategory = (typeof leadCategories)[number];
type AssignmentQuery = {
  id: string;
  status: "OPEN" | "CLOSED";
  assignedAt: string;
  closedAt: string | null;
  daysOpen: number;
};

const leadStages = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "WON",
  "LOST",
  "JUNK",
] as const;

export function LeadEditDialog({
  leadId,
  leadName,
  status,
  priority,
  category,
  assignedTo,
  assignedToName,
  assignmentQuery,
  activeUsers,
  canEdit,
  canScheduleFollowUp,
}: {
  leadId: string;
  leadName: string;
  status: (typeof leadStages)[number];
  priority: "LOW" | "MEDIUM" | "HIGH" | "HOT";
  category: LeadCategory | null;
  assignedTo: string | null;
  assignedToName: string | null;
  assignmentQuery: AssignmentQuery | null;
  activeUsers: { id: string; fullName: string }[];
  canEdit: boolean;
  canScheduleFollowUp: boolean;
}) {
  const [open, setOpen] = useState(false);
  const inactiveAssignee =
    assignedTo !== null && !activeUsers.some((user) => user.id === assignedTo);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        aria-label={`Edit ${leadName}`}
      >
        <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
        Edit
      </button>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-5">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close lead editor"
            onClick={() => setOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`edit-lead-title-${leadId}`}
            className="relative z-10 max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border bg-card shadow-2xl sm:rounded-2xl"
          >
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-card/95 px-5 py-4 backdrop-blur sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Lead workspace</p>
                <h2 id={`edit-lead-title-${leadId}`} className="mt-1 text-lg font-semibold">
                  Manage {leadName}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Update the pipeline, owner, or next follow-up.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="space-y-4 p-5 sm:p-6">
              {canEdit && (
                <>
                  <section className="rounded-xl border p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Tag className="h-4 w-4 text-primary" />
                      <div>
                        <h3 className="text-sm font-semibold">Lead category</h3>
                        <p className="text-xs text-muted-foreground">
                          Classify this lead as Ticket, Visa, or Holiday.
                        </p>
                      </div>
                    </div>
                    <form
                      action={updateLeadCategoryAction}
                      className="flex flex-col gap-2 sm:flex-row"
                    >
                      <input type="hidden" name="leadId" value={leadId} />
                      <label className="sr-only" htmlFor={`edit-category-${leadId}`}>
                        Lead category
                      </label>
                      <select
                        id={`edit-category-${leadId}`}
                        name="category"
                        defaultValue={category ?? ""}
                        className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm"
                      >
                        <option value="">Not set</option>
                        <option value="TICKET">Ticket</option>
                        <option value="VISA">Visa</option>
                        <option value="HOLIDAY">Holiday</option>
                      </select>
                      <button
                        type="submit"
                        className="h-10 rounded-lg border bg-background px-4 text-sm font-medium transition-colors hover:bg-accent"
                      >
                        Save category
                      </button>
                    </form>
                  </section>

                  <section className="rounded-xl border p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Workflow className="h-4 w-4 text-primary" />
                      <div>
                        <h3 className="text-sm font-semibold">Pipeline stage</h3>
                        <p className="text-xs text-muted-foreground">Move this lead to its current step.</p>
                      </div>
                    </div>
                    <form action={updateLeadStatusAction} className="flex flex-col gap-2 sm:flex-row">
                      <input type="hidden" name="leadId" value={leadId} />
                      <label className="sr-only" htmlFor={`edit-stage-${leadId}`}>
                        Pipeline stage
                      </label>
                      <select
                        id={`edit-stage-${leadId}`}
                        name="status"
                        defaultValue={status}
                        className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm"
                      >
                        {leadStages.map((stage) => (
                          <option key={stage} value={stage}>
                            {stage.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="h-10 rounded-lg border bg-background px-4 text-sm font-medium transition-colors hover:bg-accent"
                      >
                        Save stage
                      </button>
                    </form>
                  </section>

                  <section className="rounded-xl border p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-primary" />
                      <div>
                        <h3 className="text-sm font-semibold">Lead owner</h3>
                        <p className="text-xs text-muted-foreground">Assign this lead to an active team member.</p>
                      </div>
                    </div>
                    <form action={assignLeadAction} className="flex flex-col gap-2 sm:flex-row">
                      <input type="hidden" name="leadId" value={leadId} />
                      <label className="sr-only" htmlFor={`edit-assignee-${leadId}`}>
                        Lead owner
                      </label>
                      <select
                        id={`edit-assignee-${leadId}`}
                        name="assignedTo"
                        defaultValue={assignedTo ?? ""}
                        className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm"
                      >
                        <option value="">Unassigned</option>
                        {inactiveAssignee && (
                          <option value={assignedTo ?? ""} disabled>
                            Previously assigned (inactive)
                          </option>
                        )}
                        {activeUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.fullName}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="h-10 rounded-lg border bg-background px-4 text-sm font-medium transition-colors hover:bg-accent"
                      >
                        Save owner
                      </button>
                    </form>
                  </section>

                  <section className="rounded-xl border p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-primary" />
                      <div>
                        <h3 className="text-sm font-semibold">Assignment query</h3>
                        <p className="text-xs text-muted-foreground">
                          Track how long this assignment stays open.
                        </p>
                      </div>
                    </div>
                    {assignmentQuery ? (
                      <div className="rounded-lg bg-muted/30 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                              assignmentQuery.status === "OPEN"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                : "bg-background text-muted-foreground"
                            }`}
                          >
                            {assignmentQuery.status === "OPEN" ? (
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                            {assignmentQuery.status === "OPEN" ? "Open" : "Closed"} ·{" "}
                            {assignmentQuery.daysOpen}{" "}
                            {assignmentQuery.daysOpen === 1 ? "day" : "days"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {assignmentQuery.status === "OPEN" ? "Assigned" : "Started"}{" "}
                            {formatDate(new Date(assignmentQuery.assignedAt))}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {assignmentQuery.status === "OPEN"
                            ? `Currently assigned to ${assignedToName ?? "the selected owner"}.`
                            : `Latest query closed ${assignmentQuery.closedAt ? formatDate(new Date(assignmentQuery.closedAt)) : ""}.`}
                        </p>
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                        {assignedTo
                          ? "No query has been generated for the current assignment yet."
                          : "Assign an owner first to start a query."}
                      </p>
                    )}
                    {assignmentQuery?.status === "OPEN" ? (
                      <form action={closeLeadQueryAction} className="mt-3">
                        <input type="hidden" name="leadId" value={leadId} />
                        <input type="hidden" name="queryId" value={assignmentQuery.id} />
                        <button
                          type="submit"
                          className="h-9 rounded-lg border border-emerald-600/30 px-3 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/10 dark:text-emerald-400"
                        >
                          Close query
                        </button>
                      </form>
                    ) : assignedTo ? (
                      <form action={createLeadQueryAction} className="mt-3">
                        <input type="hidden" name="leadId" value={leadId} />
                        <button
                          type="submit"
                          className="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                          Generate new query
                        </button>
                      </form>
                    ) : null}
                  </section>
                </>
              )}

              {canScheduleFollowUp && (
                <section className="rounded-xl border p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-primary" />
                    <div>
                      <h3 className="text-sm font-semibold">Next follow-up</h3>
                      <p className="text-xs text-muted-foreground">Set a date, time, and contact method.</p>
                    </div>
                  </div>
                  <LeadFollowUpForm leadId={leadId} priority={priority} />
                </section>
              )}
              {!canEdit && !canScheduleFollowUp && (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  You can view this lead, but your role cannot edit its workflow.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
