"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { loginAction } from "@/src/features/auth/actions";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const result = await loginAction({
      identifier: String(form.get("identifier") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_460px]">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#08264a] via-[#013365] to-[#0a4b7f] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 opacity-15">
          <div className="absolute -left-32 top-20 h-96 w-96 rounded-full border-[70px] border-[#d08d3e]" />
          <div className="absolute bottom-[-160px] right-[-100px] h-[420px] w-[420px] rounded-full border-[80px] border-white" />
        </div>
        <div className="relative flex items-center gap-3 text-white">
          <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl border border-white/30 bg-white shadow-sm">
            <Image src="/assets/logo.svg" alt="JMT" width={44} height={44} className="h-11 w-11 object-contain" priority />
          </div>
          <span className="text-lg font-semibold">JMT CRM</span>
        </div>
        <div className="relative max-w-xl text-white">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-[#efc27f]">Secure workspace</p>
          <h1 className="text-5xl font-semibold leading-[1.08] tracking-tight">
            Turn every lead into an opportunity.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/70">
            Manage leads, packages, and follow-ups from one focused CRM workspace.
          </p>
        </div>
        <p className="relative text-xs text-white/50">JMT Customer Relationship Management</p>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
        <div className="w-full max-w-[400px] rounded-2xl border bg-card/85 p-6 shadow-xl shadow-primary/5 sm:p-8 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl border bg-white">
              <Image src="/assets/logo.svg" alt="JMT" width={44} height={44} className="h-11 w-11 object-contain" priority />
            </div>
            <span className="font-semibold">JMT CRM</span>
          </div>
          <div className="mb-8">
            <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-accent text-accent-foreground">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="mt-2 text-sm text-muted-foreground">Sign in to your JMT workspace</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="identifier" className="mb-2 block text-sm font-medium">Email or username</label>
              <input
                id="identifier"
                name="identifier"
                autoComplete="username"
                required
                className="h-11 w-full rounded-xl border bg-background px-3.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring"
                placeholder="Enter your email or username"
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium">Password</label>
                <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                  Need help signing in?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  className="h-11 w-full rounded-xl border bg-background px-3.5 pr-11 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1.5 grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>


            {error && (
              <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Protected by secure, session-based authentication
          </p>
        </div>
      </section>
    </main>
  );
}
