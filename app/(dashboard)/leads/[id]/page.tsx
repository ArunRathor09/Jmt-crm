import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  Clock3,
  Mail,
  MessageCircle,
  Package,
  PhoneCall,
  Plane,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/src/db";
import { followups, leadSources, leads, packages } from "@/src/db/schema";
import { formatCurrency, formatDate, getWhatsAppUrl } from "@/src/features/leads/format";
import { can } from "@/src/lib/auth/rbac";
import { getSession } from "@/src/lib/auth/session";

const priorityClasses = {
  LOW: "bg-slate-100 text-slate-700",
  MEDIUM: "bg-blue-50 text-blue-700",
  HIGH: "bg-amber-50 text-amber-800",
  HOT: "bg-rose-50 text-rose-700",
};

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}

export default async function LeadDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session.role, "leads.view")) redirect("/dashboard");

  const parsedId = z.uuid().safeParse((await params).id);
  if (!parsedId.success) notFound();

  const [lead] = await db
    .select({
      id: leads.id,
      name: leads.name,
      phone: leads.phone,
      alternatePhone: leads.alternatePhone,
      email: leads.email,
      company: leads.company,
      description: leads.description,
      sourceData: leads.sourceData,
      market: leads.market,
      city: leads.city,
      state: leads.state,
      country: leads.country,
      budget: leads.budget,
      status: leads.status,
      priority: leads.priority,
      lostReason: leads.lostReason,
      expectedCloseDate: leads.expectedCloseDate,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
      sourceName: leadSources.name,
      packageName: packages.name,
      packageDescription: packages.description,
      packagePrice: packages.price,
      packageCategory: packages.category,
      packageDurationDays: packages.durationDays,
      packageFeatures: packages.features,
    })
    .from(leads)
    .leftJoin(leadSources, eq(leads.sourceId, leadSources.id))
    .leftJoin(packages, eq(leads.packageId, packages.id))
    .where(and(eq(leads.id, parsedId.data), isNull(leads.deletedAt)))
    .limit(1);

  if (!lead) notFound();

  const [followUpRows, nextFollowUpRows] = await Promise.all([
    db
      .select({
        id: followups.id,
        type: followups.type,
        status: followups.status,
        dueAt: followups.dueAt,
        outcomeNote: followups.outcomeNote,
        priority: followups.priority,
      })
      .from(followups)
      .where(and(eq(followups.leadId, lead.id), isNull(followups.deletedAt)))
      .orderBy(desc(followups.dueAt))
      .limit(20),
    db
        .select({
          dueAt: followups.dueAt,
          isOverdue: sql<boolean>`${followups.dueAt} < now()`,
        })
      .from(followups)
      .where(
        and(
          eq(followups.leadId, lead.id),
          inArray(followups.status, ["PENDING", "RESCHEDULED"]),
          isNull(followups.deletedAt),
        ),
      )
      .orderBy(followups.dueAt)
      .limit(1),
  ]);

  const sourceEntries = Object.entries(lead.sourceData ?? {});
  const whatsappUrl = getWhatsAppUrl(lead.alternatePhone ?? lead.phone);
  const nextFollowUp = nextFollowUpRows[0] ?? null;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <Link
        href={`/leads?market=${lead.market}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {lead.market === "INTERNATIONAL" ? "International" : "Domestic"} leads
      </Link>

      <header className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-5 py-6 sm:px-7 sm:py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground shadow-sm">
                {lead.name.trim().slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  {lead.market === "INTERNATIONAL" ? "International" : "Domestic"} lead
                </p>
                <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight sm:text-3xl">
                  {lead.name}
                </h1>
                {lead.company && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    {lead.company}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-background px-2.5 py-1 text-xs font-medium">
                    {lead.status.replaceAll("_", " ")}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${priorityClasses[lead.priority]}`}>
                    {lead.priority} priority
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {lead.phone && (
                <a
                  href={`tel:${lead.phone}`}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
                >
                  <PhoneCall className="h-4 w-4" />
                  Call lead
                </a>
              )}
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-lg border bg-card px-4 text-sm font-medium transition-colors hover:bg-accent"
                >
                  <MessageCircle className="h-4 w-4 text-emerald-700" />
                  WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Lead summary">
        <article className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Package className="h-4 w-4 text-primary" />
            Selected package
          </div>
          <p className="mt-3 text-lg font-semibold">{lead.packageName ?? "No package selected"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {lead.packageCategory ?? (lead.market === "INTERNATIONAL" ? "International" : "Domestic")}
            {lead.packageDurationDays ? ` · ${lead.packageDurationDays} days` : ""}
          </p>
        </article>
        <article className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Plane className="h-4 w-4 text-primary" />
            Budget and package price
          </div>
          <p className="mt-3 text-lg font-semibold">{formatCurrency(lead.budget)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Package price: {formatCurrency(lead.packagePrice)}
          </p>
        </article>
        <article className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <CalendarClock className="h-4 w-4 text-primary" />
            Next follow-up
          </div>
          <p className="mt-3 text-lg font-semibold">
            {nextFollowUp ? formatDate(nextFollowUp.dueAt) : "Not scheduled"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {nextFollowUp?.isOverdue ? "Overdue" : "Local time (IST)"}
          </p>
        </article>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <section className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
            <div className="mb-5">
              <h2 className="font-semibold tracking-tight">Contact and lead details</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Core information captured for this prospect.
              </p>
            </div>
            <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <DetailItem
                label="Calling number"
                value={
                  lead.phone ? (
                    <a href={`tel:${lead.phone}`} className="text-primary hover:underline">
                      {lead.phone}
                    </a>
                  ) : "Not provided"
                }
              />
              <DetailItem
                label="WhatsApp number"
                value={lead.alternatePhone ?? lead.phone}
              />
              <DetailItem
                label="Email"
                value={
                  lead.email ? (
                    <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                      <Mail className="h-3.5 w-3.5" />
                      {lead.email}
                    </a>
                  ) : null
                }
              />
              <DetailItem label="Lead source" value={lead.sourceName} />
              <DetailItem
                label="Location"
                value={
                  [lead.city, lead.state, lead.country].filter(Boolean).join(", ") || null
                }
              />
              <DetailItem label="Expected close date" value={lead.expectedCloseDate ? formatDate(lead.expectedCloseDate) : null} />
              <DetailItem label="Created" value={formatDate(lead.createdAt)} />
              <DetailItem label="Last updated" value={formatDate(lead.updatedAt)} />
              <DetailItem label="Lost reason" value={lead.lostReason} />
            </dl>
            {lead.description && (
              <div className="mt-6 border-t pt-5">
                <h3 className="text-xs font-medium text-muted-foreground">Description and notes</h3>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{lead.description}</p>
              </div>
            )}
            {lead.packageDescription && (
              <div className="mt-6 border-t pt-5">
                <h3 className="text-xs font-medium text-muted-foreground">Package description</h3>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{lead.packageDescription}</p>
                {(lead.packageFeatures ?? []).length > 0 && (
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {(lead.packageFeatures ?? []).map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          <section className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
            <div className="mb-5">
              <h2 className="font-semibold tracking-tight">Travel questionnaire</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Answers and campaign fields captured when the lead was added or imported.
              </p>
            </div>
            {sourceEntries.length === 0 ? (
              <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                No questionnaire or campaign details are available for this lead.
              </p>
            ) : (
              <dl className="grid gap-3 sm:grid-cols-2">
                {sourceEntries.map(([label, value]) => (
                  <div key={label} className="min-w-0 rounded-lg border bg-muted/10 p-3.5">
                    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                    <dd className="mt-1.5 whitespace-pre-wrap break-words text-sm">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        </div>

        <section className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold tracking-tight">Follow-up history</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Recent scheduled calls and outcomes.
              </p>
            </div>
            <Clock3 className="mt-1 h-4 w-4 text-primary" />
          </div>
          {followUpRows.length === 0 ? (
            <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
              No follow-ups have been scheduled for this lead.
            </p>
          ) : (
            <ol className="space-y-5">
              {followUpRows.map((followUp, index) => (
                <li key={followUp.id} className="relative flex gap-3">
                  {index < followUpRows.length - 1 && (
                    <span aria-hidden="true" className="absolute left-[7px] top-5 h-full w-px bg-border" />
                  )}
                  <span
                    className={`relative mt-1 h-4 w-4 shrink-0 rounded-full border-4 border-background ${
                      followUp.status === "COMPLETED" ? "bg-emerald-500" : "bg-primary"
                    }`}
                  />
                  <div className="min-w-0 flex-1 pb-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{followUp.type.replaceAll("_", " ")}</p>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {followUp.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(followUp.dueAt)} · {followUp.priority} priority
                    </p>
                    {followUp.outcomeNote && (
                      <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">
                        {followUp.outcomeNote}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
          {followUpRows.length === 20 && (
            <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
              Showing the most recent 20 follow-ups.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
