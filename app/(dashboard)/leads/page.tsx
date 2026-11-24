import { and, desc, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/src/db";
import { leadSources, leads } from "@/src/db/schema";
import { can } from "@/src/lib/auth/rbac";
import { getSession } from "@/src/lib/auth/session";
import { LeadCreateForm } from "@/src/features/leads/lead-create-form";

export default async function LeadsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session.role, "leads.view")) redirect("/dashboard");

  const [leadRows, sources] = await Promise.all([
    db
      .select({
        id: leads.id,
        name: leads.name,
        phone: leads.phone,
        email: leads.email,
        company: leads.company,
        status: leads.status,
        priority: leads.priority,
        createdAt: leads.createdAt,
        sourceName: leadSources.name,
      })
      .from(leads)
      .leftJoin(leadSources, eq(leads.sourceId, leadSources.id))
      .where(isNull(leads.deletedAt))
      .orderBy(desc(leads.createdAt))
      .limit(50),
    db
      .select({ id: leadSources.id, name: leadSources.name })
      .from(leadSources)
      .where(and(eq(leadSources.active, true), isNull(leadSources.deletedAt)))
      .orderBy(leadSources.name),
  ]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Manage and track prospects</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Leads</h1>
      </div>

      {can(session.role, "leads.create") && <LeadCreateForm sources={sources} />}

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="font-semibold">All leads</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Showing the latest {leadRows.length} leads
            </p>
          </div>
        </div>
        {leadRows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            No leads yet. Add a lead to start building your pipeline.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Lead</th>
                  <th className="px-5 py-3 font-medium">Contact</th>
                  <th className="px-5 py-3 font-medium">Source</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Priority</th>
                  <th className="px-5 py-3 font-medium">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {leadRows.map((lead) => (
                  <tr key={lead.id} className="hover:bg-muted/20">
                    <td className="px-5 py-4">
                      <p className="font-medium">{lead.name}</p>
                      {lead.company && (
                        <p className="mt-1 text-xs text-muted-foreground">{lead.company}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <p>{lead.phone}</p>
                      {lead.email && (
                        <p className="mt-1 text-xs text-muted-foreground">{lead.email}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {lead.sourceName ?? "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium">
                        {lead.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-4">{lead.priority}</td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
                        lead.createdAt,
                      )}
                    </td>
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
