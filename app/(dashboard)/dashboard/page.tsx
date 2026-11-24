"use client";

import {
  ArrowUpRight,
  BriefcaseBusiness,
  CheckSquare2,
  Clock3,
  Ellipsis,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const kpis = [
  { label: "Total Leads", value: "248", change: "+12.5%", icon: Users, tone: "text-[#013365]" },
  { label: "Active Customers", value: "86", change: "+8.2%", icon: BriefcaseBusiness, tone: "text-[#b97729]" },
  { label: "Conversion Rate", value: "18.4%", change: "+2.1%", icon: TrendingUp, tone: "text-emerald-600" },
  { label: "Pending Tasks", value: "14", change: "4 overdue", icon: CheckSquare2, tone: "text-rose-600" },
];

const revenueData = [
  { month: "Jun", revenue: 38, target: 42 },
  { month: "Jul", revenue: 52, target: 48 },
  { month: "Aug", revenue: 46, target: 54 },
  { month: "Sep", revenue: 64, target: 60 },
  { month: "Oct", revenue: 58, target: 66 },
  { month: "Nov", revenue: 82, target: 72 },
];

const sourceData = [
  { name: "Website", value: 38, color: "#013365" },
  { name: "Referral", value: 26, color: "#d08d3e" },
  { name: "Social", value: 21, color: "#7f9bb7" },
  { name: "Other", value: 15, color: "#dbe3ea" },
];

const followups = [
  { name: "Rahul Sharma", company: "BrightTech", time: "10:30 AM", initials: "RS" },
  { name: "Priya Patel", company: "Mehta Industries", time: "12:15 PM", initials: "PP" },
  { name: "Amit Verma", company: "Nova Solutions", time: "3:00 PM", initials: "AV" },
];

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Monday, 24 November</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Good morning, Super Admin</h1>
        </div>
        <button type="button" className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5">
          + Add new lead
        </button>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <article key={kpi.label} className="group rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,.03)] transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
                <div className={`grid h-10 w-10 place-items-center rounded-xl bg-accent ${kpi.tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-tight">{kpi.value}</p>
              <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                <ArrowUpRight className="h-3.5 w-3.5" />
                {kpi.change}
              </p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <article className="rounded-xl border bg-card p-5 shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Revenue overview</h2>
              <p className="mt-1 text-sm text-muted-foreground">Monthly revenue trend</p>
            </div>
            <button type="button" className="rounded-lg border px-3 py-2 text-sm">Last 6 months</button>
          </div>
          <div className="mt-5 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#013365" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#013365" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} tickFormatter={(value: number) => `₹${value}k`} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", boxShadow: "0 8px 24px rgba(15,23,42,.08)" }}
                  formatter={(value) => [`₹${Number(value)}k`, "Revenue"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="#013365" strokeWidth={3} fill="url(#revenueFill)" />
                <Area type="monotone" dataKey="target" stroke="#d08d3e" strokeWidth={2} strokeDasharray="5 5" fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Lead sources</h2>
            <button type="button" aria-label="Lead source options" className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent">
              <Ellipsis className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sourceData} dataKey="value" innerRadius={58} outerRadius={78} paddingAngle={3} stroke="none">
                  {sourceData.map((source) => (
                    <Cell key={source.name} fill={source.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {sourceData.map((source) => (
              <div key={source.name} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: source.color }} />
                <span className="text-muted-foreground">{source.name}</span>
                <span className="ml-auto font-semibold">{source.value}%</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <article className="rounded-xl border bg-card p-5 shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Today&apos;s follow-ups</h2>
              <p className="mt-1 text-sm text-muted-foreground">3 meetings scheduled</p>
            </div>
            <button type="button" className="text-sm font-medium text-primary">View calendar</button>
          </div>
          <div className="mt-4 divide-y">
            {followups.map((followup) => (
              <div key={followup.name} className="flex items-center gap-3 py-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#edf2f7] text-xs font-semibold text-[#013365]">
                  {followup.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{followup.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{followup.company}</p>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-medium text-accent-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  {followup.time}
                </div>
                <button type="button" aria-label={`Open ${followup.name}`} className="grid h-8 w-8 place-items-center rounded-lg border text-muted-foreground hover:bg-accent">
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="font-semibold">Recent activity</h2>
          <div className="mt-5 space-y-5">
            {["New lead assigned", "Package purchased", "Follow-up completed"].map((activity, index) => (
              <div key={activity} className="relative flex gap-3 pl-1">
                {index < 2 && <span className="absolute left-[17px] top-9 h-8 w-px bg-border" />}
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${index === 0 ? "bg-[#edf2f7] text-[#013365]" : index === 1 ? "bg-[#fbf3e7] text-[#b97729]" : "bg-emerald-50 text-emerald-700"}`}>
                  {index === 0 ? <Users className="h-4 w-4" /> : index === 1 ? <BriefcaseBusiness className="h-4 w-4" /> : <CheckSquare2 className="h-4 w-4" />}
                </span>
                <div>
                  <p className="text-sm font-medium">{activity}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{index + 12} min ago</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
