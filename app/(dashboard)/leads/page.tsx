import { and, desc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { ArrowRight, Clock3, Eye, Flame, MessageCircle, PhoneCall, Plus, Search, Sparkles, Upload, Users } from "lucide-react";
import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/src/db";
import { updateLeadStatusAction } from "@/src/features/leads/actions";
import { LeadAutoRefresh } from "@/src/features/leads/lead-auto-refresh";
import { LeadFollowUpForm } from "@/src/features/leads/lead-follow-up-form";
import { followups, leadSources, leadStatusEnum, leads, packages, priorityEnum } from "@/src/db/schema";
import { formatCurrency, formatDate, getWhatsAppUrl } from "@/src/features/leads/format";
import { leadMarketSchema } from "@/src/features/leads/schemas";
import { can } from "@/src/lib/auth/rbac";
import { getSession } from "@/src/lib/auth/session";

const priorityClasses = {
  LOW: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  MEDIUM: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200",
  HIGH: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  HOT: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-200",
};

type PipelineStats = {
  totalLeads: number;
  newLeads: number;
  hotLeads: number;
  overdueFollowups: number;
};

type LeadPageQuery = {
  q?: string;
  status?: string;
  market?: string;
  priority?: string;
  newPage?: string;
  existingPage?: string;
};

const LEADS_PER_PAGE = 5;

function parsePage(value?: string) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

function LeadPagination({
  page,
  totalPages,
  totalRows,
  pageKey,
  params,
}: {
  page: number;
  totalPages: number;
  totalRows: number;
  pageKey: "newPage" | "existingPage";
  params: LeadPageQuery;
}) {
  if (totalPages <= 1) return null;

  const startPage = Math.max(1, Math.min(page - 2, totalPages - 4));
  const endPage = Math.min(totalPages, startPage + 4);
  const rowStart = (page - 1) * LEADS_PER_PAGE + 1;
  const rowEnd = Math.min(page * LEADS_PER_PAGE, totalRows);
  const hrefForPage = (targetPage: number) => {
    const query = new URLSearchParams();
    for (const key of ["q", "status", "market", "priority", "newPage", "existingPage"] as const) {
      if (key === pageKey) continue;
      const value = params[key];
      if (value) query.set(key, value);
    }
    query.set(pageKey, String(targetPage));
    return `/leads?${query.toString()}`;
  };
  const pageLinkClass =
    "grid h-9 min-w-9 place-items-center rounded-lg border px-2 text-sm transition-colors hover:bg-accent";

  return (
    <nav
      aria-label={`Lead list pagination, page ${page} of ${totalPages}`}
      className="flex flex-col gap-3 border-t bg-muted/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
    >
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{rowStart}–{rowEnd}</span> of{" "}
        <span className="font-medium text-foreground">{totalRows}</span>
      </p>
      <div className="flex items-center gap-1.5">
        {page > 1 ? (
          <Link href={hrefForPage(page - 1)} className={`${pageLinkClass} gap-1 px-3`}>
            <ArrowRight className="h-3.5 w-3.5 rotate-180" />
            Previous
          </Link>
        ) : (
          <span aria-disabled="true" className={`${pageLinkClass} gap-1 px-3 opacity-45`}>
            <ArrowRight className="h-3.5 w-3.5 rotate-180" />
            Previous
          </span>
        )}
        {Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index).map(
          (pageNumber) => (
            <Link
              key={pageNumber}
              href={hrefForPage(pageNumber)}
              aria-current={pageNumber === page ? "page" : undefined}
              className={`${pageLinkClass} ${
                pageNumber === page
                  ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-muted-foreground"
              }`}
            >
              {pageNumber}
            </Link>
          ),
        )}
        {page < totalPages ? (
          <Link href={hrefForPage(page + 1)} className={`${pageLinkClass} gap-1 px-3`}>
            Next
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span aria-disabled="true" className={`${pageLinkClass} gap-1 px-3 opacity-45`}>
            Next
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </nav>
  );
}

function PipelineStageControl({
  leadId,
  status,
  canEdit,
}: {
  leadId: string;
  status: (typeof leadStatusEnum.enumValues)[number];
  canEdit: boolean;
}) {
  if (!canEdit) {
    return (
      <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium">
        {status.replaceAll("_", " ")}
      </span>
    );
  }

  return (
    <form action={updateLeadStatusAction} className="flex items-center gap-1.5">
      <input type="hidden" name="leadId" value={leadId} />
      <label className="sr-only" htmlFor={`lead-stage-${leadId}`}>
        Update lead stage
      </label>
      <select
        id={`lead-stage-${leadId}`}
        name="status"
        defaultValue={status}
        className="h-9 max-w-[150px] rounded-lg border bg-background px-2 text-xs"
      >
        {leadStatusEnum.enumValues.map((option) => (
          <option key={option} value={option}>
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="h-9 rounded-lg border bg-card px-2 text-xs font-medium text-primary transition-colors hover:bg-accent"
      >
        Move
      </button>
    </form>
  );
}

export default async function LeadsPage({
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
  const market = parsedMarket.success ? parsedMarket.data : "DOMESTIC";
  const selectedStatus = leadStatusEnum.enumValues.find(
    (status) => status === params.status,
  );
  const selectedPriority = priorityEnum.enumValues.find(
    (priority) => priority === params.priority,
  );
  const conditions = [isNull(leads.deletedAt), eq(leads.market, market)];
  if (search) {
    conditions.push(
      or(
        ilike(leads.name, `%${search}%`),
        ilike(leads.phone, `%${search}%`),
        ilike(leads.company, `%${search}%`),
        ilike(leads.email, `%${search}%`),
        ilike(leads.city, `%${search}%`),
      )!,
    );
  }
  if (selectedStatus) conditions.push(eq(leads.status, selectedStatus));
  if (selectedPriority) conditions.push(eq(leads.priority, selectedPriority));

  const leadSelection = {
    id: leads.id,
    name: leads.name,
    phone: leads.phone,
    alternatePhone: leads.alternatePhone,
    email: leads.email,
    company: leads.company,
    city: leads.city,
    description: leads.description,
    sourceData: leads.sourceData,
    status: leads.status,
    priority: leads.priority,
    budget: leads.budget,
    createdAt: leads.createdAt,
    sourceName: leadSources.name,
    packageName: packages.name,
  };
  const [statsResult, statusCounts, newLeadCountResult, olderLeadCountResult] = await Promise.all([
    db.execute<PipelineStats>(sql`
      with market_stats as (
        select
          count(*)::int as "totalLeads",
          count(*) filter (where ${leads.status} = 'NEW')::int as "newLeads",
          count(*) filter (where ${leads.priority} = 'HOT')::int as "hotLeads"
        from ${leads}
        where ${leads.market} = ${market}
          and ${leads.deletedAt} is null
      )
      select
        market_stats."totalLeads",
        market_stats."newLeads",
        market_stats."hotLeads",
        (
          select count(*)::int
          from ${followups}
          inner join ${leads} on ${followups.leadId} = ${leads.id}
          where ${leads.market} = ${market}
            and ${leads.deletedAt} is null
            and ${followups.deletedAt} is null
            and ${followups.status} in ('PENDING', 'RESCHEDULED')
            and ${followups.dueAt} < now()
        ) as "overdueFollowups"
      from market_stats
    `),
    db
      .select({
        status: leads.status,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(and(isNull(leads.deletedAt), eq(leads.market, market)))
      .groupBy(leads.status),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(...conditions, eq(leads.status, "NEW"))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(...conditions, ne(leads.status, "NEW"))),
  ]);
  const stats = statsResult.rows[0];
  if (!stats) throw new Error("Lead pipeline statistics query returned no result.");

  const totalNewLeads = newLeadCountResult[0]?.count ?? 0;
  const totalOlderLeads = olderLeadCountResult[0]?.count ?? 0;
  const newTotalPages = Math.max(1, Math.ceil(totalNewLeads / LEADS_PER_PAGE));
  const olderTotalPages = Math.max(1, Math.ceil(totalOlderLeads / LEADS_PER_PAGE));
  const newPage = Math.min(parsePage(params.newPage), newTotalPages);
  const existingPage = Math.min(parsePage(params.existingPage), olderTotalPages);
  const [newLeadRows, olderLeadRows] = await Promise.all([
    db
      .select(leadSelection)
      .from(leads)
      .leftJoin(leadSources, eq(leads.sourceId, leadSources.id))
      .leftJoin(packages, eq(leads.packageId, packages.id))
      .where(and(...conditions, eq(leads.status, "NEW")))
      .orderBy(desc(leads.createdAt))
      .limit(LEADS_PER_PAGE)
      .offset((newPage - 1) * LEADS_PER_PAGE),
    db
      .select(leadSelection)
      .from(leads)
      .leftJoin(leadSources, eq(leads.sourceId, leadSources.id))
      .leftJoin(packages, eq(leads.packageId, packages.id))
      .where(and(...conditions, ne(leads.status, "NEW")))
      .orderBy(desc(leads.createdAt))
      .limit(LEADS_PER_PAGE)
      .offset((existingPage - 1) * LEADS_PER_PAGE),
  ]);

  const leadIds = [...newLeadRows, ...olderLeadRows].map((lead) => lead.id);
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
  const canScheduleFollowUp =
    can(session.role, "leads.edit") || can(session.role, "tasks.manage");
  const canEditLeads = can(session.role, "leads.edit");
  for (const followup of upcomingFollowups) {
    if (followup.leadId && !nextFollowUpByLead.has(followup.leadId)) {
      nextFollowUpByLead.set(followup.leadId, followup.dueAt);
    }
  }
  const statusCountByStatus = new Map(statusCounts.map(({ status, count }) => [status, count]));
  const pipelineStages = [
    { status: "NEW", label: "New", hint: "Needs first contact" },
    { status: "CONTACTED", label: "Contacted", hint: "Conversation started" },
    { status: "QUALIFIED", label: "Qualified", hint: "Needs confirmed" },
    { status: "PROPOSAL_SENT", label: "Proposal", hint: "Offer shared" },
    { status: "NEGOTIATION", label: "Negotiation", hint: "In discussion" },
    { status: "WON", label: "Won", hint: "Converted" },
  ] as const;

  const kpis = [
    {
      label: "Total leads",
      value: stats.totalLeads,
      detail: "In this category",
      icon: Users,
      tone: "text-primary",
    },
    {
      label: "New leads",
      value: stats.newLeads,
      detail: "Ready to follow up",
      icon: Plus,
      tone: "text-blue-700",
      href: `/leads?market=${market}&status=NEW`,
    },
    {
      label: "Hot priority",
      value: stats.hotLeads,
      detail: "High-intent prospects",
      icon: Flame,
      tone: "text-rose-700",
      href: `/leads?market=${market}&priority=HOT`,
    },
    {
      label: "Overdue follow-ups",
      value: stats.overdueFollowups,
      detail: "Action required",
      icon: Clock3,
      tone: stats.overdueFollowups > 0 ? "text-amber-700" : "text-emerald-700",
    },
  ];

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <LeadAutoRefresh />
      <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <Sparkles className="h-4 w-4" />
            Lead workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {market === "DOMESTIC" ? "Domestic" : "International"} leads
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            A clear view of new opportunities and your existing pipeline, all in one place.
          </p>
        </div>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <form
            action="/leads"
            className="flex flex-wrap gap-2"
            role="search"
            aria-label="Filter leads"
          >
            <select
              name="market"
              defaultValue={market}
              className="h-10 rounded-xl border bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring"
              aria-label="Lead category"
            >
              <option value="DOMESTIC">Domestic</option>
              <option value="INTERNATIONAL">International</option>
            </select>
            <input
              name="q"
              defaultValue={search}
              placeholder="Search name, phone, email, city"
              className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring sm:w-64"
            />
            <select
              name="status"
              defaultValue={selectedStatus ?? ""}
              className="h-10 rounded-xl border bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring"
            >
              <option value="">All statuses</option>
              {leadStatusEnum.enumValues.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <select
              name="priority"
              defaultValue={selectedPriority ?? ""}
              className="h-10 rounded-xl border bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring"
              aria-label="Priority"
            >
              <option value="">All priorities</option>
              {priorityEnum.enumValues.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="inline-flex h-10 items-center gap-2 rounded-xl border bg-background px-4 text-sm font-medium transition hover:bg-accent"
            >
              <Search className="h-4 w-4" />
              Search
            </button>
          </form>
          {can(session.role, "leads.create") && (
            <div className="flex gap-2">
              <Link
                href={`/leads/add?market=${market}`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                Add lead
              </Link>
              <Link
                href={`/leads/add?market=${market}#csv-import`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border bg-background px-4 text-sm font-medium transition hover:bg-accent"
              >
                <Upload className="h-4 w-4" />
                Import CSV
              </Link>
            </div>
          )}
        </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Lead pipeline summary">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          const content = (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent ${kpi.tone}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-tight">{kpi.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{kpi.detail}</p>
            </>
          );
          const className =
            "rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md sm:p-5";
          return kpi.href ? (
            <Link key={kpi.label} href={kpi.href} className={className}>
              {content}
            </Link>
          ) : (
            <article key={kpi.label} className={className}>
              {content}
            </article>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm" aria-labelledby="pipeline-heading">
        <div className="flex flex-col gap-1 border-b px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="pipeline-heading" className="font-semibold">Lead pipeline</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Track each opportunity from first contact through conversion.
            </p>
          </div>
          <Link
            href={`/leads?market=${market}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            View all {stats.totalLeads} leads
          </Link>
        </div>
        <div className="overflow-x-auto p-4 sm:p-5">
          <ol className="flex min-w-[780px] items-stretch gap-2">
            {pipelineStages.map((stage, index) => {
              const count = statusCountByStatus.get(stage.status) ?? 0;
              const isSelected = selectedStatus === stage.status;
              return (
                <Fragment key={stage.status}>
                  <li className="min-w-0 flex-1">
                    <Link
                      href={`/leads?market=${market}&status=${stage.status}`}
                      aria-current={isSelected ? "step" : undefined}
                      className={`group flex h-full flex-col rounded-xl border p-3 transition-colors hover:border-primary/40 hover:bg-accent/50 ${
                        isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "bg-background"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {stage.label}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          isSelected ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
                        }`}>
                          {count}
                        </span>
                      </span>
                      <span className="mt-2 text-xs text-muted-foreground">{stage.hint}</span>
                    </Link>
                  </li>
                  {index < pipelineStages.length - 1 && (
                    <li aria-hidden="true" className="flex items-center text-muted-foreground/60">
                      <span className="h-px w-3 bg-border" />
                      <ArrowRight className="h-3.5 w-3.5" />
                    </li>
                  )}
                </Fragment>
              );
            })}
          </ol>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {(["LOST", "JUNK"] as const).map((status) => (
              <Link
                key={status}
                href={`/leads?market=${market}&status=${status}`}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent"
              >
                {status === "LOST" ? "Lost" : "Junk"}
                <span className="font-semibold text-foreground">
                  {statusCountByStatus.get(status) ?? 0}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm" aria-labelledby="new-leads-heading">
        <div className="flex flex-col gap-3 border-b bg-gradient-to-r from-accent/70 to-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2 id="new-leads-heading" className="font-semibold">New leads</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Review new prospects and schedule their next action without leaving the table.
              </p>
            </div>
          </div>
          <span className="w-fit rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            {totalNewLeads} total · Page {newPage} of {newTotalPages}
          </span>
        </div>
        {newLeadRows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            No new leads match these filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1320px] text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Lead</th>
                  <th className="px-5 py-3 font-medium">Contact</th>
                  <th className="px-5 py-3 font-medium">Package / budget</th>
                  <th className="px-5 py-3 font-medium">Pipeline stage</th>
                  <th className="px-5 py-3 font-medium">Next follow-up / schedule</th>
                  <th className="px-5 py-3 font-medium">Priority</th>
                  <th className="px-5 py-3 font-medium">Source</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {newLeadRows.map((lead) => {
                  const sourceData = lead.sourceData ?? {};
                  const sourceEntries = Object.entries(sourceData);
                  const whatsappUrl = getWhatsAppUrl(lead.alternatePhone ?? lead.phone);
                  const nextFollowUp = nextFollowUpByLead.get(lead.id) ?? null;

                  return (
                    <Fragment key={lead.id}>
                      <tr className="align-top transition-colors hover:bg-muted/20">
                        <td className="max-w-[240px] px-5 py-4">
                          <Link href={`/leads/${lead.id}`} className="font-semibold hover:text-primary">
                            {lead.name}
                          </Link>
                          {(lead.company || lead.city) && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {[lead.company, lead.city].filter(Boolean).join(" · ")}
                            </p>
                          )}
                          {lead.email && (
                            <p className="mt-1 truncate text-xs text-muted-foreground">{lead.email}</p>
                          )}
                          <p className="mt-2 text-xs text-muted-foreground">Added {formatDate(lead.createdAt)}</p>
                        </td>
                        <td className="px-5 py-4">
                          {lead.phone ? (
                            <div className="flex items-center gap-2">
                              <a
                                href={`tel:${lead.phone}`}
                                className="font-medium text-primary hover:underline"
                                aria-label={`Call ${lead.name}`}
                              >
                                {lead.phone}
                              </a>
                              {whatsappUrl && (
                                <a
                                  href={whatsappUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950"
                                  aria-label={`WhatsApp ${lead.name}`}
                                  title="Open WhatsApp"
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No phone provided</span>
                          )}
                          {lead.alternatePhone && lead.alternatePhone !== lead.phone && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Alternate: {lead.alternatePhone}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-medium">{lead.packageName ?? "Not selected"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(lead.budget)}</p>
                        </td>
                        <td className="px-5 py-4">
                          <PipelineStageControl
                            leadId={lead.id}
                            status={lead.status}
                            canEdit={canEditLeads}
                          />
                        </td>
                        <td className="min-w-[290px] px-5 py-4">
                          <p className={nextFollowUp ? "font-medium" : "text-xs text-muted-foreground"}>
                            {nextFollowUp ? formatDate(nextFollowUp) : "No follow-up scheduled"}
                          </p>
                          {canScheduleFollowUp ? (
                            <LeadFollowUpForm leadId={lead.id} priority={lead.priority} />
                          ) : (
                            <p className="mt-2 text-xs text-muted-foreground">
                              You do not have permission to schedule follow-ups.
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${priorityClasses[lead.priority]}`}>
                            {lead.priority}
                          </span>
                        </td>
                        <td className="max-w-[180px] px-5 py-4 text-muted-foreground">
                          {lead.sourceName ?? sourceData.integration_source ?? "—"}
                        </td>
                        <td className="px-5 py-4">
                          <Link
                            href={`/leads/${lead.id}`}
                            className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium text-primary transition-colors hover:bg-accent"
                            aria-label={`View ${lead.name}`}
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Link>
                        </td>
                      </tr>
                      {sourceEntries.length > 0 && (
                        <tr className="bg-muted/10">
                          <td colSpan={8} className="px-5 py-3">
                            <details>
                              <summary className="cursor-pointer text-sm font-medium text-primary">
                                View {sourceEntries.length} form details
                              </summary>
                              <dl className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {sourceEntries.map(([label, value]) => (
                                  <div key={label} className="rounded-lg border bg-card p-3">
                                    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                                    <dd className="mt-1 whitespace-pre-wrap break-words text-sm">{value}</dd>
                                  </div>
                                ))}
                              </dl>
                            </details>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <LeadPagination
          page={newPage}
          totalPages={newTotalPages}
          totalRows={totalNewLeads}
          pageKey="newPage"
          params={params}
        />
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="font-semibold">Existing leads</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {totalOlderLeads} {totalOlderLeads === 1 ? "lead" : "leads"}
              {" · "}Page {existingPage} of {olderTotalPages}
              {search || selectedStatus || selectedPriority ? " matching your filters" : ""}
            </p>
          </div>
        </div>
        {olderLeadRows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            No existing leads match these filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Lead</th>
                  <th className="px-5 py-3 font-medium">City</th>
                  <th className="px-5 py-3 font-medium">Calling number</th>
                  <th className="px-5 py-3 font-medium">Package / price</th>
                  <th className="px-5 py-3 font-medium">Next follow-up</th>
                  <th className="px-5 py-3 font-medium">Priority</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Source</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {olderLeadRows.map((lead) => {
                  const sourceData = lead.sourceData ?? {};
                  const sourceEntries = Object.entries(sourceData);
                  const whatsappUrl = getWhatsAppUrl(lead.alternatePhone ?? lead.phone);
                  return (
                    <Fragment key={lead.id}>
                      <tr className="align-top hover:bg-muted/20">
                        <td className="max-w-[280px] px-5 py-4">
                          <p className="font-medium">{lead.name}</p>
                          {lead.company && (
                            <p className="mt-1 text-xs text-muted-foreground">{lead.company}</p>
                          )}
                          {lead.description && (
                            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                              {lead.description}
                            </p>
                          )}
                          {lead.email && (
                            <p className="mt-1 truncate text-xs text-muted-foreground">{lead.email}</p>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">
                            Added {formatDate(lead.createdAt)}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">{lead.city ?? "—"}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {lead.phone && (
                              <a
                                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-primary hover:bg-accent"
                                href={`tel:${lead.phone}`}
                                aria-label={`Call ${lead.name}`}
                                title="Call lead"
                              >
                                <PhoneCall className="h-4 w-4" />
                              </a>
                            )}
                            {whatsappUrl && (
                              <a
                                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-emerald-700 hover:bg-emerald-50"
                                href={whatsappUrl}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`WhatsApp ${lead.name}`}
                                title="Open WhatsApp"
                              >
                                <MessageCircle className="h-4 w-4" />
                              </a>
                            )}
                            <div>
                              {lead.phone ? (
                                <a className="font-medium text-primary hover:underline" href={`tel:${lead.phone}`}>
                                  {lead.phone}
                                </a>
                              ) : (
                                <span className="text-muted-foreground">No phone provided</span>
                              )}
                              {lead.alternatePhone && lead.alternatePhone !== lead.phone && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  WhatsApp: {lead.alternatePhone}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-medium">{lead.packageName ?? "Not selected"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatCurrency(lead.budget)}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">
                          {formatDate(nextFollowUpByLead.get(lead.id) ?? null)}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${priorityClasses[lead.priority]}`}>
                            {lead.priority}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <PipelineStageControl
                            leadId={lead.id}
                            status={lead.status}
                            canEdit={canEditLeads}
                          />
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">
                          {lead.sourceName ?? sourceData.integration_source ?? "—"}
                        </td>
                        <td className="px-5 py-4">
                          <Link
                            href={`/leads/${lead.id}`}
                            className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium text-primary transition-colors hover:bg-accent"
                            aria-label={`View ${lead.name}`}
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Link>
                        </td>
                      </tr>
                      {sourceEntries.length > 0 && (
                        <tr className="bg-muted/10">
                          <td colSpan={9} className="px-5 py-3">
                            <details>
                              <summary className="cursor-pointer text-sm font-medium text-primary">
                                View {sourceEntries.length} form details
                              </summary>
                              <dl className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {sourceEntries.map(([label, value]) => (
                                  <div key={label} className="rounded-lg border bg-card p-3">
                                    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                                    <dd className="mt-1 whitespace-pre-wrap break-words text-sm">{value}</dd>
                                  </div>
                                ))}
                              </dl>
                            </details>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <LeadPagination
          page={existingPage}
          totalPages={olderTotalPages}
          totalRows={totalOlderLeads}
          pageKey="existingPage"
          params={params}
        />
      </section>
    </div>
  );
}
