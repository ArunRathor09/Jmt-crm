import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/src/components/layout/app-shell";
import { getSession } from "@/src/lib/auth/session";

export const instant = false;

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <AuthenticatedDashboardLayout>{children}</AuthenticatedDashboardLayout>
    </Suspense>
  );
}

async function AuthenticatedDashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/change-password");

  return (
    <AppShell role={session.role}>
      <Suspense fallback={<PageLoading />}>{children}</Suspense>
    </AppShell>
  );
}

function WorkspaceLoading() {
  return (
    <div
      role="status"
      className="grid min-h-screen place-items-center bg-background"
    >
      <span className="sr-only">Checking your session...</span>
      <span
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary"
      />
    </div>
  );
}

function PageLoading() {
  return (
    <div
      role="status"
      className="grid min-h-[calc(100vh-4rem)] place-items-center bg-background"
    >
      <span className="sr-only">Loading page...</span>
      <span
        aria-hidden="true"
        className="h-7 w-7 animate-spin rounded-full border-2 border-muted border-t-primary"
      />
    </div>
  );
}
