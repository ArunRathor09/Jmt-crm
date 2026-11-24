import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { Clock3, Flame, MessageCircle, PhoneCall, Plus, Search, Upload, Users } from "lucide-react";
import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/src/db";
import { followups, leadSources, leadStatusEnum, leads, packages, priorityEnum } from "@/src/db/schema";
import { leadMarketSchema } from "@/src/features/leads/schemas";
import { can } from "@/src/lib/auth/rbac";
import { getSession } from "@/src/lib/auth/session";

const priorityClasses = {
  LOW: "bg-slate-100 text-slate-700",
  MEDIUM: "bg-blue-50 text-blue-700",
  HIGH: "bg-amber-50 text-amber-800",
  HOT: "bg-rose-50 text-rose-700",
};

type PipelineStats = {
  totalLeads: number;
  newLeads: number;
  hotLeads: number;
  overdueFollowups: number;
};

function formatCurrency(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

function getWhatsAppUrl(phone: string) {
  const rawDigits = phone.replace(/\D/g, "");
  const digits = rawDigits.startsWith("00") ? rawDigits.slice(2) : rawDigits;
  const localDigits =
    digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
  const normalized = localDigits.length === 10 ? `91${localDigits}` : localDigits;
  return normalized ? `https://wa.me/${normalized}` : null;
}

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

  const [statsResult, leadRows] = await Promise.all([
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
      })
      .from(leads)
      .leftJoin(leadSources, eq(leads.sourceId, leadSources.id))
      .leftJoin(packages, eq(leads.packageId, packages.id))
      .where(and(...conditions))
      .orderBy(desc(leads.createdAt))
      .limit(100),
  ]);
  const stats = statsResult.rows[0];
  if (!stats) throw new Error("Lead pipeline statistics query returned no result.");

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
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Lead management
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {market === "DOMESTIC" ? "Domestic" : "International"} leads
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track lead quality, package interest, and the next follow-up.
          </p>
        </div>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <form action="/leads" className="flex flex-wrap gap-2">
            <select
              name="market"
              defaultValue={market}
              className="h-10 rounded-lg border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              aria-label="Lead category"
            >
              <option value="DOMESTIC">Domestic</option>
              <option value="INTERNATIONAL">International</option>
            </select>
            <input
              name="q"
              defaultValue={search}
              placeholder="Search name, phone, email, city"
              className="h-10 w-full rounded-lg border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring sm:w-64"
            />
            <select
              name="status"
              defaultValue={selectedStatus ?? ""}
              className="h-10 rounded-lg border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
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
              className="h-10 rounded-lg border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
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
              className="inline-flex h-10 items-center gap-2 rounded-lg border bg-card px-4 text-sm font-medium hover:bg-accent"
            >
              <Search className="h-4 w-4" />
              Search
            </button>
          </form>
          {can(session.role, "leads.create") && (
            <div className="flex gap-2">
              <Link
                href={`/leads/add?market=${market}`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                Add lead
              </Link>
              <Link
                href={`/leads/add?market=${market}#csv-import`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border bg-card px-4 text-sm font-medium hover:bg-accent"
              >
                <Upload className="h-4 w-4" />
                Import CSV
              </Link>
            </div>
          )}
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Lead pipeline summary">
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
            "rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/30 sm:p-5";
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

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="font-semibold">Lead pipeline</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Showing {leadRows.length} {leadRows.length === 1 ? "lead" : "leads"}
              {search || selectedStatus || selectedPriority ? " matching your filters" : ""}
              {leadRows.length === 100 ? " (latest 100)" : ""}
            </p>
          </div>
        </div>
        {leadRows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            No leads match these filters. Use Add lead or Import CSV to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1360px] text-left text-sm">
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
                </tr>
              </thead>
              <tbody className="divide-y">
                {leadRows.map((lead) => {
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
                            <a
                              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-primary hover:bg-accent"
                              href={`tel:${lead.phone}`}
                              aria-label={`Call ${lead.name}`}
                              title="Call lead"
                            >
                              <PhoneCall className="h-4 w-4" />
                            </a>
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
                              <a className="font-medium text-primary hover:underline" href={`tel:${lead.phone}`}>
                                {lead.phone}
                              </a>
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
                        <td className="px-5 py-4 text-muted-foreground">{lead.sourceName ?? "—"}</td>
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
      </section>
    </div>
  );
}
