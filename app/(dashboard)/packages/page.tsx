import { asc, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/src/db";
import { packages } from "@/src/db/schema";
import { PackageCreateForm } from "@/src/features/packages/package-create-form";
import { PackageRowActions } from "@/src/features/packages/package-row-actions";
import { can } from "@/src/lib/auth/rbac";
import { getSession } from "@/src/lib/auth/session";

export const instant = false;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function PackagesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session.role, "packages.manage")) redirect("/dashboard");

  const packageRows = await db
    .select({
      id: packages.id,
      name: packages.name,
      category: packages.category,
      price: packages.price,
      description: packages.description,
      durationDays: packages.durationDays,
      status: packages.status,
    })
    .from(packages)
    .where(isNull(packages.deletedAt))
    .orderBy(asc(packages.category), asc(packages.name));

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Manage travel packages and prices</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Packages</h1>
      </div>

      <PackageCreateForm />

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Package catalog</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {packageRows.length} {packageRows.length === 1 ? "package" : "packages"} across all categories
          </p>
        </div>
        {packageRows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            No packages yet. Add one above to make it available in Leads.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Package</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Price</th>
                  <th className="px-5 py-3 font-medium">Duration</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {packageRows.map((item) => (
                  <tr key={item.id} className="align-top hover:bg-muted/20">
                    <td className="max-w-[360px] px-5 py-4">
                      <p className="font-medium">{item.name}</p>
                      {item.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {item.category === "INTERNATIONAL"
                        ? "International"
                        : item.category === "DOMESTIC"
                          ? "Domestic"
                          : "Uncategorized"}
                    </td>
                    <td className="px-5 py-4 font-medium">{formatCurrency(item.price)}</td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {item.durationDays ? `${item.durationDays} days` : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          item.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {item.status === "ACTIVE" ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <PackageRowActions
                        packageId={item.id}
                        packageName={item.name}
                        status={item.status}
                      />
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
