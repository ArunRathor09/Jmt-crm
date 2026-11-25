import { and, asc, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/src/db";
import { leadSources, packages } from "@/src/db/schema";
import { LeadCreateForm } from "@/src/features/leads/lead-create-form";
import { LeadImportForm } from "@/src/features/leads/lead-import-form";
import { leadMarketSchema } from "@/src/features/leads/schemas";
import { can } from "@/src/lib/auth/rbac";
import { getSession } from "@/src/lib/auth/session";

export default async function AddLeadPage({
  searchParams,
}: {
  searchParams: Promise<{ market?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session.role, "leads.create")) redirect("/leads");

  const params = await searchParams;
  const parsedMarket = leadMarketSchema.safeParse(params.market);
  const market = parsedMarket.success ? parsedMarket.data : "DOMESTIC";

  const [sources, availablePackages] = await Promise.all([
    db
      .select({ id: leadSources.id, name: leadSources.name })
      .from(leadSources)
      .where(and(eq(leadSources.active, true), isNull(leadSources.deletedAt)))
      .orderBy(leadSources.name),
    db
      .select({
        id: packages.id,
        name: packages.name,
        price: packages.price,
        category: packages.category,
      })
      .from(packages)
      .where(and(eq(packages.status, "ACTIVE"), isNull(packages.deletedAt)))
      .orderBy(asc(packages.name)),
  ]);
  const importPackages = availablePackages.filter((item) => item.category === market);

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Add a lead manually or import a Meta lead export
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Add Leads</h1>
        </div>
        <Link
          href="/leads"
          className="inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-medium hover:bg-accent"
        >
          View all leads
        </Link>
      </div>

      <LeadCreateForm
        initialMarket={market}
        sources={sources}
        packages={availablePackages}
      />
      <LeadImportForm market={market} packages={importPackages} />
    </div>
  );
}
