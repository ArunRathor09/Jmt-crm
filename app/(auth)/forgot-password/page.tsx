"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl sm:p-8">
        <div className="mb-7 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl border bg-white">
            <Image src="/assets/logo.svg" alt="JMT" width={44} height={44} className="h-11 w-11" />
          </div>
          <p className="font-semibold">JMT CRM</p>
        </div>
        <div className="mb-6 grid h-11 w-11 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Mail className="h-5 w-5" />
        </div>
        <h1 className="text-xl font-semibold">Reset your password</h1>
        {submitted ? (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">
              If an account matches that email, reset instructions will be sent shortly.
            </p>
            <Link href="/login" className="mt-6 block h-11 rounded-lg bg-primary py-[12px] text-center text-sm font-semibold text-primary-foreground">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5">
            <label htmlFor="email" className="mb-2 block text-sm font-medium">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="h-11 w-full rounded-lg border bg-background px-3.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="you@company.com"
            />
            <button type="submit" className="mt-4 h-11 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
              Send reset instructions
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
