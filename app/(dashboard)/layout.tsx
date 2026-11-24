import { redirect } from "next/navigation";
import { AppShell } from "@/src/components/layout/app-shell";
import { getSession } from "@/src/lib/auth/session";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/change-password");
  return <AppShell role={session.role}>{children}</AppShell>;
}
