import { redirect } from "next/navigation";
import { getSession } from "@/src/lib/auth/session";
import DashboardContent from "./dashboard-content";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/change-password");

  return <DashboardContent fullName={session.fullName} />;
}
