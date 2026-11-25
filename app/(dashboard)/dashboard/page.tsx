import { and, inArray, isNull, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/src/db";
import { customers, followups, leads, tasks } from "@/src/db/schema";
import { getSession } from "@/src/lib/auth/session";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckSquare2,
  Clock3,
  Users,
} from "lucide-react";

type DashboardStats = {
  totalLeads: number;
  wonLeads: number;
  activeCustomers: number;
  openTasks: number;
};

export const instant = false;

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/change-password");

  const [statsResult, upcomingFollowups] = await Promise.all([
    db.execute<DashboardStats>(sql`
      with lead_stats as (
        select
          count(*)::int as "totalLeads",
          count(*) filter (where ${leads.status} = 'WON')::int as "wonLeads"
        from ${leads}
        where ${leads.deletedAt} is null
      )
      select
        lead_stats."totalLeads",
        lead_stats."wonLeads",
        (
          select count(*)::int
          from ${customers}
          where ${customers.deletedAt} is null
            and ${customers.status} = 'ACTIVE'
        ) as "activeCustomers",
        (
          select count(*)::int
          from ${tasks}
          where ${tasks.deletedAt} is null
            and ${tasks.status} in ('TODO', 'IN_PROGRESS', 'BLOCKED')
        ) as "openTasks"
      from lead_stats
    `),
    db
      .select({
        id: followups.id,
        dueAt: followups.dueAt,
        isOverdue: sql<boolean>`${followups.dueAt} < now()`,
        type: followups.type,
        name: sql<string>`coalesce(${leads.name}, ${customers.name}, 'Follow-up')`,
        phone: sql<string | null>`coalesce(${leads.phone}, ${customers.phone})`,
      })
      .from(followups)
      .leftJoin(leads, sql`${followups.leadId} = ${leads.id}`)
      .leftJoin(customers, sql`${followups.customerId} = ${customers.id}`)
      .where(
        and(
          inArray(followups.status, ["PENDING", "RESCHEDULED"]),
          isNull(followups.deletedAt),
        ),
      )
      .orderBy(followups.dueAt)
      .limit(5),
  ]);
  const stats = statsResult.rows[0];
  if (!stats) throw new Error("Dashboard statistics query returned no result.");

  const conversionRate = stats.totalLeads
    ? `${Math.round((stats.wonLeads / stats.totalLeads) * 100)}%`
    : "0%";
  const kpis = [
    {
      label: "Total leads",
      value: stats.totalLeads,
      icon: Users,
      iconTone: "bg-primary/10 text-primary",
    },
    {
      label: "Active customers",
      value: stats.activeCustomers,
      icon: BriefcaseBusiness,
      iconTone: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    },
    {
      label: "Conversion rate",
      value: conversionRate,
      icon: ArrowUpRight,
      iconTone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
    {
      label: "Open tasks",
      value: stats.openTasks,
      icon: CheckSquare2,
      iconTone: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    },
  ];

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 sm:space-y-8">
      <header className="relative isolate overflow-hidden rounded-2xl border bg-gradient-to-br from-primary via-primary to-[#08284a] px-5 py-6 text-primary-foreground shadow-lg shadow-primary/10 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:px-7 sm:py-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-20 hidden h-64 w-64 rounded-full border-[32px] border-white/10 sm:block"
        />
        <div className="relative min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground/70">
            {new Intl.DateTimeFormat("en-IN", {
              dateStyle: "full",
              timeZone: "Asia/Kolkata",
            }).format(new Date())}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome back, {session.fullName}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-primary-foreground/75">
            Here&apos;s a quick view of your leads and the next actions for your team.
          </p>
        </div>
        <Link
          href="/leads"
          className="relative mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-primary shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white/90 sm:mt-0 sm:w-auto"
        >
          Manage leads
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          const value =
            typeof kpi.value === "number"
              ? new Intl.NumberFormat("en-IN").format(kpi.value)
              : kpi.value;
          return (
            <article
              key={kpi.label}
              className="group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${kpi.iconTone}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-5 text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
                {value}
              </p>
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-primary/70 transition-transform duration-200 group-hover:scale-x-100"
              />
            </article>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <CalendarClock className="h-4 w-4" />
              </span>
              <h2 className="font-semibold tracking-tight">Next follow-ups</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {upcomingFollowups.length
                ? `Showing the next ${upcomingFollowups.length} scheduled follow-ups`
                : "No pending follow-ups"}
            </p>
          </div>
          <Link
            href="/leads"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
          >
            View leads <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
        </div>
        {upcomingFollowups.length > 0 && (
          <div className="divide-y">
            {upcomingFollowups.map((followup) => (
              <div
                key={followup.id}
                className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/30 sm:px-6"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                  <Clock3 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{followup.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {followup.phone ?? followup.type}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`text-[11px] font-semibold ${
                      followup.isOverdue
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {followup.isOverdue ? "Overdue" : "Scheduled"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(followup.dueAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {upcomingFollowups.length === 0 && (
          <div className="px-5 py-10 text-center sm:px-6">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground">
              <CalendarClock className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-medium">You&apos;re all caught up</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Scheduled follow-ups will appear here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
