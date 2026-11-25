import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-10 text-center">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl shadow-primary/5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">404 · Not found</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The link may be outdated, or the page may have moved.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Return to dashboard
        </Link>
      </div>
    </main>
  );
}
