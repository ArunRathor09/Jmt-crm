import { and, desc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { ArrowUpRight, Clock3, Eye, Flame, MessageCircle, PhoneCall, Plus, Search, Sparkles, Upload, Users } from "lucide-react";
import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/src/db";
import { LeadAutoRefresh } from "@/src/features/leads/lead-auto-refresh";
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

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; market?: string; priority?: string }>;
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
  const [statsResult, newLeadRows, olderLeadRows] = await Promise.all([
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
      .select(leadSelection)
      .from(leads)
      .leftJoin(leadSources, eq(leads.sourceId, leadSources.id))
      .leftJoin(packages, eq(leads.packageId, packages.id))
      .where(and(...conditions, eq(leads.status, "NEW")))
      .orderBy(desc(leads.createdAt))
      .limit(8),
    db
      .select(leadSelection)
      .from(leads)
      .leftJoin(leadSources, eq(leads.sourceId, leadSources.id))
      .leftJoin(packages, eq(leads.packageId, packages.id))
      .where(and(...conditions, ne(leads.status, "NEW")))
      .orderBy(desc(leads.createdAt))
      .limit(100),
  ]);
  const stats = statsResult.rows[0];
  if (!stats) throw new Error("Lead pipeline statistics query returned no result.");

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
  for (const followup of upcomingFollowups) {
    if (followup.leadId && !nextFollowUpByLead.has(followup.leadId)) {
      nextFollowUpByLead.set(followup.leadId, followup.dueAt);
    }
  }

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

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm" aria-labelledby="new-leads-heading">
        <div className="flex flex-col gap-3 border-b bg-gradient-to-r from-accent/70 to-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2 id="new-leads-heading" className="font-semibold">New leads</h2>
              <p className="mt-1 text-sm text-muted-foreground">Fresh opportunities ready for your first follow-up</p>
            </div>
          </div>
          <span className="w-fit rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            Showing {newLeadRows.length} latest
          </span>
        </div>
        {newLeadRows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            No new leads match these filters.
          </p>
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            {newLeadRows.map((lead) => {
              const whatsappUrl = getWhatsAppUrl(lead.alternatePhone ?? lead.phone);
              return (
                <article key={lead.id} className="flex min-w-0 flex-col rounded-xl border bg-background/70 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-sm font-semibold text-accent-foreground">
                      {lead.name.trim().slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/leads/${lead.id}`} className="block truncate text-sm font-semibold hover:text-primary">
                        {lead.name}
                      </Link>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{lead.company ?? lead.city ?? "New prospect"}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${priorityClasses[lead.priority]}`}>
                      {lead.priority}
                    </span>
                  </div>
                  <div className="mt-4 space-y-2 border-t pt-3 text-xs">
                    <p className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Interested in</span>
                      <span className="truncate font-medium">{lead.packageName ?? "Package not selected"}</span>
                    </p>
                    <p className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Budget</span>
                      <span className="font-medium">{formatCurrency(lead.budget)}</span>
                    </p>
                    <p className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Added</span>
                      <span className="font-medium">{formatDate(lead.createdAt)}</span>
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    {lead.phone && (
                      <a href={`tel:${lead.phone}`} className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border bg-card text-xs font-medium text-primary transition hover:bg-accent" aria-label={`Call ${lead.name}`}>
                        <PhoneCall className="h-3.5 w-3.5" />
                        Call
                      </a>
                    )}
                    {whatsappUrl && (
                      <a href={whatsappUrl} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-lg border bg-card text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950" aria-label={`WhatsApp ${lead.name}`}>
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    )}
                    <Link href={`/leads/${lead.id}`} className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground transition hover:opacity-90" aria-label={`View ${lead.name}`}>
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="font-semibold">Existing leads</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {olderLeadRows.length} {olderLeadRows.length === 1 ? "lead" : "leads"}
              {olderLeadRows.length === 100 ? " (latest 100)" : ""}
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
                          <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium">
                            {lead.status.replaceAll("_", " ")}
                          </span>
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
      </section>
    </div>
  );
}
