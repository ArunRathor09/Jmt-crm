import Image from "next/image";
import Link from "next/link";
import { Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  return (
    <main
      className="grid min-h-screen place-items-center bg-background px-4 py-8"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at top, color-mix(in oklch, var(--primary) 8%, transparent), transparent 55%)",
      }}
    >
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl shadow-primary/5 sm:p-8">
        <div className="mb-7 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl border bg-white">
            <Image src="/assets/logo.svg" alt="JMT" width={44} height={44} className="h-11 w-11 object-contain" />
          </div>
          <p className="font-semibold">JMT CRM</p>
        </div>
        <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Mail className="h-5 w-5" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Password reset unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Automated password reset is not configured for this workspace. Contact your
          administrator to regain access.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
