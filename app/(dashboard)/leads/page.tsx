import { and, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/src/db";
import { followups, leadSources, leadStatusEnum, leads, packages } from "@/src/db/schema";
import { LeadCreateForm } from "@/src/features/leads/lead-create-form";
import { LeadImportForm } from "@/src/features/leads/lead-import-form";
import { leadMarketSchema } from "@/src/features/leads/schemas";
import { can } from "@/src/lib/auth/rbac";
import { getSession } from "@/src/lib/auth/session";

const priorityClasses = {
  LOW: "bg-slate-100 text-slate-700",
  MEDIUM: "bg-blue-50 text-blue-700",
  HIGH: "bg-amber-50 text-amber-800",
  HOT: "bg-rose-50 text-rose-700",
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

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; market?: string }>;
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
  const conditions = [isNull(leads.deletedAt), eq(leads.market, market)];
  if (search) {
    conditions.push(
      or(
        ilike(leads.name, `%${search}%`),
        ilike(leads.phone, `%${search}%`),
        ilike(leads.company, `%${search}%`),
      )!,
    );
  }
  if (selectedStatus) conditions.push(eq(leads.status, selectedStatus));

  const [leadRows, sources, availablePackages] = await Promise.all([
    db
      .select({
        id: leads.id,
        name: leads.name,
        phone: leads.phone,
        email: leads.email,
        company: leads.company,
        description: leads.description,
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
    db
      .select({ id: leadSources.id, name: leadSources.name })
      .from(leadSources)
      .where(and(eq(leadSources.active, true), isNull(leadSources.deletedAt)))
      .orderBy(leadSources.name),
    db
      .select({ id: packages.id, name: packages.name, price: packages.price })
      .from(packages)
      .where(
        and(
          eq(packages.category, market),
          eq(packages.status, "ACTIVE"),
          isNull(packages.deletedAt),
        ),
      )
      .orderBy(packages.name),
  ]);

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

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Manage and track prospects</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {market === "DOMESTIC" ? "Domestic" : "International"} leads
          </h1>
        </div>
        <form action="/leads" className="flex gap-2">
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
            placeholder="Search name, phone, company"
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
          <button type="submit" className="h-10 rounded-lg border px-4 text-sm font-medium hover:bg-accent">
            Search
          </button>
        </form>
      </div>

      {can(session.role, "leads.create") && (
        <>
          <LeadImportForm market={market} />
          <LeadCreateForm market={market} sources={sources} packages={availablePackages} />
        </>
      )}

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="font-semibold">Lead pipeline</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Showing {leadRows.length} {leadRows.length === 1 ? "lead" : "leads"}
              {search || selectedStatus ? " matching your filters" : ""}
              {leadRows.length === 100 ? " (latest 100)" : ""}
            </p>
          </div>
        </div>
        {leadRows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            No leads match these filters. Add a lead or import a CSV to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Lead</th>
                  <th className="px-5 py-3 font-medium">Calling number</th>
                  <th className="px-5 py-3 font-medium">Package / price</th>
                  <th className="px-5 py-3 font-medium">Next follow-up</th>
                  <th className="px-5 py-3 font-medium">Priority</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {leadRows.map((lead) => (
                  <tr key={lead.id} className="align-top hover:bg-muted/20">
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
                    </td>
                    <td className="px-5 py-4">
                      <a className="font-medium text-primary hover:underline" href={`tel:${lead.phone}`}>
                        {lead.phone}
                      </a>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
