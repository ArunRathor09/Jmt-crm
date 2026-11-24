import { and, inArray, isNull, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/src/db";
import { customers, followups, leads, tasks } from "@/src/db/schema";
import { getSession } from "@/src/lib/auth/session";
import {
  ArrowUpRight,
  BriefcaseBusiness,
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
    { label: "Total leads", value: stats.totalLeads, icon: Users, tone: "text-[#013365]" },
    { label: "Active customers", value: stats.activeCustomers, icon: BriefcaseBusiness, tone: "text-[#b97729]" },
    { label: "Conversion rate", value: conversionRate, icon: ArrowUpRight, tone: "text-emerald-600" },
    { label: "Open tasks", value: stats.openTasks, icon: CheckSquare2, tone: "text-rose-600" },
  ];

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {new Intl.DateTimeFormat("en-IN", {
              dateStyle: "full",
              timeZone: "Asia/Kolkata",
            }).format(new Date())}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Welcome, {session.fullName}
          </h1>
        </div>
        <Link
          href="/leads"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          + Manage leads
        </Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <article key={kpi.label} className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
                <div className={`grid h-10 w-10 place-items-center rounded-xl bg-accent ${kpi.tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-tight">{kpi.value}</p>
            </article>
          );
        })}
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Next follow-ups</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {upcomingFollowups.length
                ? `${upcomingFollowups.length} upcoming or overdue`
                : "No pending follow-ups"}
            </p>
          </div>
          <Link href="/leads" className="text-sm font-medium text-primary hover:underline">
            View leads
          </Link>
        </div>
        {upcomingFollowups.length > 0 && (
          <div className="mt-4 divide-y">
            {upcomingFollowups.map((followup) => (
              <div key={followup.id} className="flex items-center gap-3 py-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-primary">
                  <Clock3 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{followup.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {followup.phone ?? followup.type}
                  </p>
                </div>
                <p className="text-right text-xs text-muted-foreground">
                  {formatDate(followup.dueAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
