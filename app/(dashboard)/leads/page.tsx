import {
  and,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNull,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import { ArrowRight, ClipboardList, Eye, Plus, Search, Upload, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/src/db";
import {
  followups,
  leadCategoryEnum,
  leadQueries,
  leadStatusEnum,
  leads,
  priorityEnum,
  users as usersTable,
} from "@/src/db/schema";
import { LeadAutoRefresh } from "@/src/features/leads/lead-auto-refresh";
import { LeadEditDialog } from "@/src/features/leads/lead-edit-dialog";
import { formatDate } from "@/src/features/leads/format";
import { leadMarketSchema, leadServiceTypeSchema } from "@/src/features/leads/schemas";
import { can } from "@/src/lib/auth/rbac";
import { getSession } from "@/src/lib/auth/session";
import { z } from "zod";

type LeadPageQuery = {
  q?: string;
  category?: string;
  status?: string;
  priority?: string;
  assignee?: string;
  queryStatus?: string;
  market?: string;
  serviceType?: string;
  page?: string;
};

const LEADS_PER_PAGE = 50;

export const instant = false;

function parsePage(value?: string) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

function LeadPagination({
  page,
  totalPages,
  totalRows,
  params,
}: {
  page: number;
  totalPages: number;
  totalRows: number;
  params: LeadPageQuery;
}) {
  if (totalPages <= 1) return null;

  const rowStart = (page - 1) * LEADS_PER_PAGE + 1;
  const rowEnd = Math.min(page * LEADS_PER_PAGE, totalRows);
  const hrefForPage = (targetPage: number) => {
    const query = new URLSearchParams();
    for (const key of [
      "q",
      "category",
      "status",
      "priority",
      "assignee",
      "queryStatus",
      "market",
      "serviceType",
    ] as const) {
      const value = params[key];
      if (value) query.set(key, value);
    }
    query.set("page", String(targetPage));
    return `/leads?${query.toString()}#lead-summary`;
  };
  const buttonClass =
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors hover:bg-accent";

  return (
    <footer className="flex shrink-0 flex-col gap-2 border-t bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{rowStart}–{rowEnd}</span> of{" "}
        <span className="font-medium text-foreground">{totalRows}</span>
      </p>
      <nav aria-label={`Lead pagination, page ${page} of ${totalPages}`} className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={hrefForPage(page - 1)} className={buttonClass}>
            <ArrowRight className="h-3.5 w-3.5 rotate-180" />
            Previous
          </Link>
        ) : (
          <span aria-disabled="true" className={`${buttonClass} opacity-45`}>
            <ArrowRight className="h-3.5 w-3.5 rotate-180" />
            Previous
          </span>
        )}
        <span className="px-1 text-xs tabular-nums text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        {page < totalPages ? (
          <Link href={hrefForPage(page + 1)} className={buttonClass}>
            Next
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span aria-disabled="true" className={`${buttonClass} opacity-45`}>
            Next
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        )}
      </nav>
    </footer>
  );
}

export default function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<LeadPageQuery>;
}) {
  return (
    <Suspense fallback={<LeadsPageFallback />}>
      <LeadsContent searchParams={searchParams} />
    </Suspense>
  );
}

function LeadsPageFallback() {
  return (
    <div
      role="status"
      aria-label="Loading leads"
      className="mx-auto flex h-[calc(100dvh-8rem)] min-h-[360px] max-w-[1700px] flex-col gap-3"
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-32 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-64 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-10 w-32 animate-pulse rounded-xl bg-muted" />
      </div>
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="shrink-0 space-y-3 border-b p-4">
          <div className="h-6 w-40 animate-pulse rounded-md bg-muted" />
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-9 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 divide-y overflow-hidden">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="flex h-[68px] items-center gap-4 px-5">
              <div className="h-4 w-8 animate-pulse rounded bg-muted" />
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
              <div className="ml-auto h-8 w-20 animate-pulse rounded-lg bg-muted" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

async function LeadsContent({
  searchParams,
}: {
  searchParams: Promise<LeadPageQuery>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session.role, "leads.view")) redirect("/dashboard");

  const params = await searchParams;
  const search = params.q?.trim().slice(0, 100) ?? "";
  const parsedMarket = leadMarketSchema.safeParse(params.market);
  const parsedServiceType = leadServiceTypeSchema.safeParse(params.serviceType);
  let selectedMarket = parsedMarket.success ? parsedMarket.data : undefined;
  const selectedServiceType = parsedServiceType.success ? parsedServiceType.data : undefined;
  if (selectedServiceType && selectedMarket !== "DOMESTIC") selectedMarket = "INTERNATIONAL";

  const parsedAssignee = z.uuid().safeParse(params.assignee);
  const selectedAssignee = parsedAssignee.success
    ? parsedAssignee.data
    : params.assignee === "unassigned"
      ? "unassigned"
      : "";
  const selectedStatus = leadStatusEnum.enumValues.find((status) => status === params.status);
  const selectedCategory = leadCategoryEnum.enumValues.find(
    (category) => category === params.category,
  );
  const selectedPriority = priorityEnum.enumValues.find((priority) => priority === params.priority);
  const queryStatuses = ["OPEN", "CLOSED", "NONE"] as const;
  const selectedQueryStatus = queryStatuses.find((status) => status === params.queryStatus);
  const serviceFilter = selectedMarket === "INTERNATIONAL" ? selectedServiceType : undefined;
  const conditions = [isNull(leads.deletedAt)];

  if (selectedMarket) conditions.push(eq(leads.market, selectedMarket));
  if (serviceFilter) conditions.push(eq(leads.serviceType, serviceFilter));
  if (search) {
    conditions.push(
      or(
        ilike(leads.name, `%${search}%`),
        ilike(leads.phone, `%${search}%`),
        ilike(leads.email, `%${search}%`),
        ilike(leads.company, `%${search}%`),
        ilike(leads.city, `%${search}%`),
      )!,
    );
  }
  if (selectedStatus) conditions.push(eq(leads.status, selectedStatus));
  if (selectedCategory) conditions.push(eq(leads.category, selectedCategory));
  if (selectedPriority) conditions.push(eq(leads.priority, selectedPriority));
  if (selectedAssignee === "unassigned") {
    conditions.push(isNull(leads.assignedTo));
  } else if (selectedAssignee) {
    conditions.push(eq(leads.assignedTo, selectedAssignee));
  }
  const openQueriesForLead = db
    .select({ id: leadQueries.id })
    .from(leadQueries)
    .where(and(eq(leadQueries.leadId, leads.id), eq(leadQueries.status, "OPEN")));
  if (selectedQueryStatus === "OPEN") {
    conditions.push(exists(openQueriesForLead));
  } else if (selectedQueryStatus === "CLOSED") {
    conditions.push(
      exists(
        db
          .select({ id: leadQueries.id })
          .from(leadQueries)
          .where(and(eq(leadQueries.leadId, leads.id), eq(leadQueries.status, "CLOSED"))),
      ),
      notExists(openQueriesForLead),
    );
  } else if (selectedQueryStatus === "NONE") {
    conditions.push(notExists(openQueriesForLead));
    conditions.push(
      notExists(
        db
          .select({ id: leadQueries.id })
          .from(leadQueries)
          .where(eq(leadQueries.leadId, leads.id)),
      ),
    );
  }

  const [countResult, departmentCounts, activeUsers] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(...conditions)),
    db
      .select({
        market: leads.market,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(isNull(leads.deletedAt))
      .groupBy(leads.market),
    db
      .select({ id: usersTable.id, fullName: usersTable.fullName })
      .from(usersTable)
      .where(and(eq(usersTable.active, true), isNull(usersTable.deletedAt)))
      .orderBy(usersTable.fullName),
  ]);
  const totalLeads = countResult[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalLeads / LEADS_PER_PAGE));
  const page = Math.min(parsePage(params.page), totalPages);
  const leadRows = await db
    .select({
      id: leads.id,
      name: leads.name,
      phone: leads.phone,
      email: leads.email,
      market: leads.market,
      serviceType: leads.serviceType,
      status: leads.status,
      priority: leads.priority,
      category: leads.category,
      assignedTo: leads.assignedTo,
      assignedToName: usersTable.fullName,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .leftJoin(usersTable, eq(leads.assignedTo, usersTable.id))
    .where(and(...conditions))
    .orderBy(desc(leads.createdAt), desc(leads.id))
    .limit(LEADS_PER_PAGE)
    .offset((page - 1) * LEADS_PER_PAGE);

  const leadIds = leadRows.map((lead) => lead.id);
  const upcomingFollowups =
    leadIds.length === 0
      ? []
      : await db
          .selectDistinctOn([followups.leadId], {
            leadId: followups.leadId,
            dueAt: followups.dueAt,
          })
          .from(followups)
          .where(
            and(
              inArray(followups.leadId, leadIds),
              inArray(followups.status, ["PENDING", "RESCHEDULED"]),
              isNull(followups.deletedAt),
            ),
          )
          .orderBy(followups.leadId, followups.dueAt);
  const nextFollowUpByLead = new Map<string, Date>();
  for (const followup of upcomingFollowups) {
    if (followup.leadId && !nextFollowUpByLead.has(followup.leadId)) {
      nextFollowUpByLead.set(followup.leadId, followup.dueAt);
    }
  }

  const latestQueries =
    leadIds.length === 0
      ? []
      : await db
          .selectDistinctOn([leadQueries.leadId], {
            id: leadQueries.id,
            leadId: leadQueries.leadId,
            status: leadQueries.status,
            assignedAt: leadQueries.assignedAt,
            closedAt: leadQueries.closedAt,
          })
          .from(leadQueries)
          .where(inArray(leadQueries.leadId, leadIds))
          .orderBy(leadQueries.leadId, desc(leadQueries.assignedAt));
  const latestQueryByLead = new Map(latestQueries.map((query) => [query.leadId, query]));

  const departmentCountByMarket = new Map(
    departmentCounts.map(({ market, count }) => [market, count]),
  );
  const departmentHref = (market?: "DOMESTIC" | "INTERNATIONAL") => {
    const query = new URLSearchParams();
    for (const key of [
      "q",
      "category",
      "status",
      "priority",
      "assignee",
      "queryStatus",
    ] as const) {
      const value = params[key];
      if (value) query.set(key, value);
    }
    if (market) query.set("market", market);
    if (market === "INTERNATIONAL" && serviceFilter) {
      query.set("serviceType", serviceFilter);
    }
    const queryString = query.toString();
    return queryString ? `/leads?${queryString}#lead-summary` : "/leads#lead-summary";
  };
  const canEditLeads = can(session.role, "leads.edit");
  const canScheduleFollowUp = canEditLeads || can(session.role, "tasks.manage");

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] min-h-[360px] max-w-[1700px] flex-col gap-3 overflow-hidden">
      <LeadAutoRefresh />
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage departments, lead owners, pipeline stages, and follow-ups.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="#lead-summary"
            className="hidden h-10 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium transition-colors hover:bg-accent sm:inline-flex"
          >
            <ClipboardList className="h-4 w-4" />
            Lead Summary
          </Link>
          {can(session.role, "leads.create") && (
            <>
              <Link
                href="/leads/add"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Add lead
              </Link>
              <Link
                href="/leads/add#csv-import"
                className="inline-flex h-10 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium transition-colors hover:bg-accent"
              >
                <Upload className="h-4 w-4" />
                Import
              </Link>
            </>
          )}
        </div>
      </header>

      <section
        id="lead-summary"
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm"
        aria-labelledby="lead-summary-heading"
      >
        <div className="shrink-0 border-b bg-gradient-to-r from-accent/60 to-card p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-4 w-4" />
              </span>
              <div>
                <h2 id="lead-summary-heading" className="font-semibold">Lead Summary</h2>
                <p className="text-xs text-muted-foreground">
                  {totalLeads} matching {totalLeads === 1 ? "lead" : "leads"}
                </p>
              </div>
            </div>
            <nav aria-label="Lead departments" className="flex flex-wrap items-center gap-1 rounded-xl border bg-background p-1">
              {[
                {
                  label: "All leads",
                  href: departmentHref(),
                  selected: !selectedMarket,
                },
                {
                  label: "Domestic",
                  href: departmentHref("DOMESTIC"),
                  selected: selectedMarket === "DOMESTIC",
                  count: departmentCountByMarket.get("DOMESTIC") ?? 0,
                },
                {
                  label: "International",
                  href: departmentHref("INTERNATIONAL"),
                  selected: selectedMarket === "INTERNATIONAL",
                  count: departmentCountByMarket.get("INTERNATIONAL") ?? 0,
                },
              ].map((department) => (
                <Link
                  key={department.label}
                  href={department.href}
                  aria-current={department.selected ? "page" : undefined}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors ${
                    department.selected
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {department.label}
                  {"count" in department && (
                    <span className="tabular-nums opacity-75">{department.count}</span>
                  )}
                </Link>
              ))}
            </nav>
          </div>

          <form
            action="/leads#lead-summary"
            className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(200px,1.5fr)_repeat(6,minmax(120px,1fr))_auto_auto]"
            role="search"
            aria-label="Filter leads"
          >
            {selectedMarket && <input type="hidden" name="market" value={selectedMarket} />}
            <input
              name="q"
              defaultValue={search}
              placeholder="Search name, phone, email"
              className="col-span-2 h-9 min-w-0 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring sm:col-span-1"
            />
            <select
              name="serviceType"
              defaultValue={serviceFilter ?? ""}
              disabled={selectedMarket !== "INTERNATIONAL"}
              className="h-9 min-w-0 rounded-lg border bg-background px-2.5 text-sm disabled:opacity-50"
              aria-label="International service"
            >
              <option value="">All international services</option>
              <option value="TRAVEL">Travel</option>
              <option value="VISA">Visa</option>
            </select>
            <select
              name="category"
              defaultValue={selectedCategory ?? ""}
              className="h-9 min-w-0 rounded-lg border bg-background px-2.5 text-sm"
              aria-label="Lead category"
            >
              <option value="">All categories</option>
              <option value="TICKET">Ticket</option>
              <option value="VISA">Visa</option>
              <option value="HOLIDAY">Holiday</option>
            </select>
            <select
              name="status"
              defaultValue={selectedStatus ?? ""}
              className="h-9 min-w-0 rounded-lg border bg-background px-2.5 text-sm"
              aria-label="Pipeline stage"
            >
              <option value="">All stages</option>
              {leadStatusEnum.enumValues.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <select
              name="priority"
              defaultValue={selectedPriority ?? ""}
              className="h-9 min-w-0 rounded-lg border bg-background px-2.5 text-sm"
              aria-label="Lead priority"
            >
              <option value="">All priorities</option>
              {priorityEnum.enumValues.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
            <select
              name="assignee"
              defaultValue={selectedAssignee}
              className="h-9 min-w-0 rounded-lg border bg-background px-2.5 text-sm"
              aria-label="Lead owner"
            >
              <option value="">All owners</option>
              <option value="unassigned">Unassigned</option>
              {activeUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName}
                </option>
              ))}
            </select>
            <select
              name="queryStatus"
              defaultValue={selectedQueryStatus ?? ""}
              className="h-9 min-w-0 rounded-lg border bg-background px-2.5 text-sm"
              aria-label="Query status"
            >
              <option value="">All queries</option>
              <option value="OPEN">Open queries</option>
              <option value="CLOSED">Closed queries</option>
              <option value="NONE">No query</option>
            </select>
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Search className="h-4 w-4" />
              Apply
            </button>
            {(search ||
              selectedStatus ||
              selectedCategory ||
              selectedPriority ||
              selectedAssignee ||
              selectedQueryStatus ||
              serviceFilter) && (
              <Link
                href={
                  selectedMarket
                    ? `/leads?market=${selectedMarket}#lead-summary`
                    : "/leads#lead-summary"
                }
                className="inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Clear
              </Link>
            )}
          </form>
        </div>

        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <table className="w-full min-w-[1450px] border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 z-20 bg-muted/95 text-[11px] uppercase tracking-wide text-muted-foreground backdrop-blur">
              <tr>
                <th className="sticky left-0 top-0 z-30 w-14 min-w-14 border-r bg-muted px-2 py-3 font-semibold sm:w-16 sm:min-w-16 sm:px-4">S.No</th>
                <th className="sticky left-14 top-0 z-30 w-[140px] min-w-[140px] border-r bg-muted px-2 py-3 font-semibold sm:left-16 sm:w-[220px] sm:min-w-[220px] sm:px-4">Lead name</th>
                <th className="sticky top-0 z-20 min-w-[150px] bg-muted px-4 py-3 font-semibold">Phone</th>
                <th className="sticky top-0 z-20 min-w-[210px] bg-muted px-4 py-3 font-semibold">Email</th>
                <th className="sticky top-0 z-20 min-w-[150px] bg-muted px-4 py-3 font-semibold">Department</th>
                <th className="sticky top-0 z-20 min-w-[120px] bg-muted px-4 py-3 font-semibold">Category</th>
                <th className="sticky top-0 z-20 min-w-[150px] bg-muted px-4 py-3 font-semibold">Lead owner</th>
                <th className="sticky top-0 z-20 min-w-[200px] bg-muted px-4 py-3 font-semibold">Query</th>
                <th className="sticky top-0 z-20 min-w-[190px] bg-muted px-4 py-3 font-semibold">Next follow-up</th>
                <th className="sticky right-0 top-0 z-30 w-28 min-w-28 border-l bg-muted px-2 py-3 text-right font-semibold sm:w-[180px] sm:min-w-[180px] sm:px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {leadRows.map((lead, index) => {
                const nextFollowUp = nextFollowUpByLead.get(lead.id) ?? null;
                const assignmentQuery = latestQueryByLead.get(lead.id) ?? null;
                const queryAgeDays = assignmentQuery
                  ? Math.max(
                      0,
                      Math.floor(
                        ((assignmentQuery.closedAt ?? new Date()).getTime() -
                          assignmentQuery.assignedAt.getTime()) /
                          86_400_000,
                      ),
                    )
                  : null;
                const departmentLabel =
                  lead.market === "INTERNATIONAL"
                    ? `International${lead.serviceType ? ` · ${lead.serviceType === "VISA" ? "Visa" : "Travel"}` : ""}`
                    : "Domestic";

                return (
                  <tr key={lead.id} className="group transition-colors hover:bg-muted/30">
                    <td className="sticky left-0 z-10 w-14 min-w-14 border-r bg-card px-2 py-3.5 text-xs font-medium tabular-nums text-muted-foreground group-hover:bg-muted/30 sm:w-16 sm:min-w-16 sm:px-4">
                      {(page - 1) * LEADS_PER_PAGE + index + 1}
                    </td>
                    <td className="sticky left-14 z-10 w-[140px] min-w-[140px] border-r bg-card px-2 py-3.5 group-hover:bg-muted/30 sm:left-16 sm:w-[220px] sm:min-w-[220px] sm:px-4">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="block truncate font-semibold text-foreground hover:text-primary"
                      >
                        {lead.name}
                      </Link>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Added {formatDate(lead.createdAt)}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      {lead.phone ? (
                        <a href={`tel:${lead.phone}`} className="text-primary hover:underline">
                          {lead.phone}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="max-w-[240px] truncate px-4 py-3.5">
                      {lead.email ? (
                        <a href={`mailto:${lead.email}`} className="text-muted-foreground hover:text-primary">
                          {lead.email}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex rounded-full border bg-background px-2.5 py-1 text-xs font-medium">
                        {departmentLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {lead.category ? (
                        <span className="inline-flex rounded-full border bg-primary/5 px-2.5 py-1 text-xs font-medium">
                          {lead.category === "TICKET" ? "Ticket" : lead.category === "VISA" ? "Visa" : "Holiday"}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not set</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-sm">
                      {lead.assignedToName ?? <span className="text-muted-foreground">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      {assignmentQuery ? (
                        <>
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                              assignmentQuery.status === "OPEN"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {assignmentQuery.status === "OPEN" ? "Open" : "Closed"} · {queryAgeDays}{" "}
                            {queryAgeDays === 1 ? "day" : "days"}
                          </span>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Assigned {formatDate(assignmentQuery.assignedAt)}
                          </p>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">No query generated</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {nextFollowUp ? (
                        <span className="font-medium">{formatDate(nextFollowUp)}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not scheduled</span>
                      )}
                    </td>
                    <td className="sticky right-0 z-10 w-28 min-w-28 border-l bg-card px-2 py-3.5 group-hover:bg-muted/30 sm:w-[180px] sm:min-w-[180px] sm:px-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/leads/${lead.id}`}
                          aria-label={`View ${lead.name}`}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border bg-background px-0 text-xs font-medium transition-colors hover:bg-accent sm:w-auto sm:px-2.5"
                        >
                          <Eye aria-hidden="true" className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">View</span>
                        </Link>
                        <LeadEditDialog
                          leadId={lead.id}
                          leadName={lead.name}
                          status={lead.status}
                          priority={lead.priority}
                          category={lead.category}
                          assignedTo={lead.assignedTo}
                          assignmentQuery={
                            assignmentQuery
                              ? {
                                  id: assignmentQuery.id,
                                  status: assignmentQuery.status,
                                  assignedAt: assignmentQuery.assignedAt.toISOString(),
                                  closedAt: assignmentQuery.closedAt?.toISOString() ?? null,
                                  daysOpen: queryAgeDays ?? 0,
                                }
                              : null
                          }
                          assignedToName={lead.assignedToName}
                          activeUsers={activeUsers}
                          canEdit={canEditLeads}
                          canScheduleFollowUp={canScheduleFollowUp}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {leadRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-16 text-center">
                    <p className="font-medium">No leads found</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Adjust the filters or choose another department.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <LeadPagination page={page} totalPages={totalPages} totalRows={totalLeads} params={params} />
      </section>
    </div>
  );
}
