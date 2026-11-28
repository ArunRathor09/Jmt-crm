import { and, asc, desc, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import {
  ArrowUpRight,
  CalendarClock,
  Check,
  CircleAlert,
  Clock3,
  Phone,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/src/db";
import { customers, followups, leads, users } from "@/src/db/schema";
import { completeLeadFollowUpAction } from "@/src/features/leads/actions";
import { formatDate } from "@/src/features/leads/format";
import { can } from "@/src/lib/auth/rbac";
import { getSession } from "@/src/lib/auth/session";

type FollowUpView = "all" | "today" | "overdue" | "completed";
const OPEN_STATUSES = ["PENDING", "RESCHEDULED"] as const;
const COMPLETED_STATUSES = ["COMPLETED", "MISSED", "CANCELLED"] as const;
const BUSINESS_TIME_ZONE = "Asia/Kolkata";
const FOLLOW_UPS_PER_PAGE = 150;

function getBusinessDayEnd(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const dateParts = new Map(parts.map(({ type, value }) => [type, value]));
  const today = `${dateParts.get("year")}-${dateParts.get("month")}-${dateParts.get("day")}`;
  const tomorrow = new Date(`${today}T00:00:00.000Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return new Date(`${tomorrow.toISOString().slice(0, 10)}T00:00:00+05:30`);
}

function parseView(value?: string): FollowUpView {
  return value === "today" || value === "overdue" || value === "completed"
    ? value
    : "all";
}

function getTypeLabel(type: string) {
  if (type === "WHATSAPP") return "WhatsApp";
  return type.charAt(0) + type.slice(1).toLowerCase();
}

export const instant = false;

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const view = parseView(params.view);
  const now = new Date();
  const dayEnd = getBusinessDayEnd(now);
  const activeStatuses = inArray(followups.status, OPEN_STATUSES);
  const conditions = [isNull(followups.deletedAt)];

  if (view === "today") {
    conditions.push(activeStatuses, gte(followups.dueAt, now), lt(followups.dueAt, dayEnd));
  } else if (view === "overdue") {
    conditions.push(activeStatuses, lt(followups.dueAt, now));
  } else if (view === "completed") {
    conditions.push(inArray(followups.status, COMPLETED_STATUSES));
  } else {
    conditions.push(activeStatuses);
  }

  const [statsResult, followUpRows] = await Promise.all([
    db.execute<{
      openCount: number;
      todayCount: number;
      overdueCount: number;
      completedCount: number;
    }>(sql`
      select
        count(*) filter (
          where ${followups.status} in ('PENDING', 'RESCHEDULED')
        )::int as "openCount",
        count(*) filter (
          where ${followups.status} in ('PENDING', 'RESCHEDULED')
            and ${followups.dueAt} >= ${now}
            and ${followups.dueAt} < ${dayEnd}
        )::int as "todayCount",
        count(*) filter (
          where ${followups.status} in ('PENDING', 'RESCHEDULED')
            and ${followups.dueAt} < ${now}
        )::int as "overdueCount",
        count(*) filter (
          where ${followups.status} in ('COMPLETED', 'MISSED', 'CANCELLED')
        )::int as "completedCount"
      from ${followups}
      where ${followups.deletedAt} is null
    `),
    db
      .select({
        id: followups.id,
        leadId: followups.leadId,
        name: sql<string>`coalesce(${leads.name}, ${customers.name}, 'Follow-up')`,
        phone: sql<string | null>`coalesce(${leads.phone}, ${customers.phone})`,
        dueAt: followups.dueAt,
        type: followups.type,
        status: followups.status,
        priority: followups.priority,
        notes: followups.outcomeNote,
        assignedToName: users.fullName,
      })
      .from(followups)
      .leftJoin(leads, sql`${followups.leadId} = ${leads.id}`)
      .leftJoin(customers, sql`${followups.customerId} = ${customers.id}`)
      .leftJoin(users, sql`${followups.assignedTo} = ${users.id}`)
      .where(and(...conditions))
      .orderBy(view === "completed" ? desc(followups.updatedAt) : asc(followups.dueAt))
      .limit(FOLLOW_UPS_PER_PAGE),
  ]);
  const stats = statsResult.rows[0];
  if (!stats) throw new Error("Follow-up summary query returned no result.");

  const canCompleteFollowUps =
    can(session.role, "leads.edit") || can(session.role, "tasks.manage");
  const views: { id: FollowUpView; label: string; count: number }[] = [
    { id: "all", label: "All open", count: stats.openCount },
    { id: "today", label: "Today", count: stats.todayCount },
    { id: "overdue", label: "Overdue", count: stats.overdueCount },
    { id: "completed", label: "Completed", count: stats.completedCount },
  ];

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
            <CalendarClock className="h-3.5 w-3.5" />
            Follow-up workspace
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Follow-ups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep every lead touchpoint on time, from the next call to later reminders.
          </p>
        </div>
        <Link
          href="/leads"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Schedule from leads
          <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </header>

      <section aria-label="Follow-up summary" className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Open follow-ups", value: stats.openCount, icon: CalendarClock, tone: "text-primary bg-primary/10" },
          { label: "Due today", value: stats.todayCount, icon: Clock3, tone: "text-amber-700 bg-amber-500/10 dark:text-amber-400" },
          { label: "Overdue", value: stats.overdueCount, icon: CircleAlert, tone: "text-destructive bg-destructive/10" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <article key={stat.label} className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
                <span className={`grid h-9 w-9 place-items-center rounded-xl ${stat.tone}`}>
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">{stat.value}</p>
            </article>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b bg-gradient-to-r from-primary/[0.06] via-card to-card p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="font-semibold tracking-tight">Follow-up schedule</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {view === "completed"
                ? "Recently completed or closed reminders"
                : "Sorted by the soonest scheduled time"}
            </p>
          </div>
          <nav aria-label="Filter follow-ups" className="flex flex-wrap gap-1 rounded-xl border bg-background/80 p-1">
            {views.map((item) => (
              <Link
                key={item.id}
                href={item.id === "all" ? "/follow-ups" : `/follow-ups?view=${item.id}`}
                aria-current={view === item.id ? "page" : undefined}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors ${
                  view === item.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {item.label}
                <span className="tabular-nums opacity-75">{item.count}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="divide-y">
          {followUpRows.map((followUp) => {
            const isOverdue =
              (followUp.status === "PENDING" || followUp.status === "RESCHEDULED") &&
              followUp.dueAt.getTime() < now.getTime();
            return (
              <article
                key={followUp.id}
                className="group flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:px-5"
              >
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                  isOverdue ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                }`}>
                  <Phone aria-hidden="true" className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-semibold">{followUp.name}</h3>
                    <span className="rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {getTypeLabel(followUp.type)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      isOverdue
                        ? "bg-destructive/10 text-destructive"
                        : followUp.status === "COMPLETED"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                    }`}>
                      {isOverdue ? "Overdue"                       : followUp.status.charAt(0) +
                        followUp.status.slice(1).toLowerCase().replaceAll("_", " ")}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                      <Clock3 aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
                      {formatDate(followUp.dueAt)}
                    </span>
                    {followUp.phone && <span>{followUp.phone}</span>}
                    <span>Priority: {followUp.priority}</span>
                    {followUp.assignedToName && <span>Assigned to {followUp.assignedToName}</span>}
                  </div>
                  {followUp.notes && (
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{followUp.notes}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
                  {followUp.leadId && (
                    <Link
                      href={`/leads/${followUp.leadId}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-background px-3 text-xs font-medium transition-colors hover:bg-accent"
                    >
                      Open lead
                      <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                    </Link>
                  )}
                  {canCompleteFollowUps &&
                    (followUp.status === "PENDING" || followUp.status === "RESCHEDULED") && (
                      <form action={completeLeadFollowUpAction}>
                        <input type="hidden" name="followUpId" value={followUp.id} />
                        <button
                          type="submit"
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                        >
                          <Check aria-hidden="true" className="h-3.5 w-3.5" />
                          Complete
                        </button>
                      </form>
                    )}
                </div>
              </article>
            );
          })}
          {followUpRows.length === 0 && (
            <div className="px-5 py-16 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                <CalendarClock aria-hidden="true" className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold">
                {view === "completed"
                  ? "No completed follow-ups yet"
                  : view === "today"
                    ? "No follow-ups due today"
                    : view === "overdue"
                      ? "You are all caught up"
                      : "No open follow-ups"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Schedule one or more reminders from a lead to see them here.
              </p>
            </div>
          )}
        </div>
        {followUpRows.length === FOLLOW_UPS_PER_PAGE && (
          <p className="border-t px-5 py-3 text-center text-xs text-muted-foreground">
            Showing the first {FOLLOW_UPS_PER_PAGE} follow-ups. Narrow the view to find a specific date.
          </p>
        )}
      </section>
    </div>
  );
}
