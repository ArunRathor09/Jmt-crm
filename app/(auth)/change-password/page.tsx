"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { changePasswordAction } from "@/src/features/auth/actions";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const result = await changePasswordAction({
      currentPassword: String(form.get("currentPassword") ?? ""),
      newPassword: String(form.get("newPassword") ?? ""),
      confirmPassword: String(form.get("confirmPassword") ?? ""),
    });
    if (result.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl sm:p-8">
        <div className="mb-7 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl border bg-white">
            <Image src="/assets/logo.svg" alt="JMT" width={44} height={44} className="h-11 w-11" />
          </div>
          <div>
            <p className="font-semibold">JMT CRM</p>
            <p className="text-xs text-muted-foreground">Account security</p>
          </div>
        </div>
        <div className="mb-6">
          <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
            <KeyRound className="h-4 w-4" />
          </div>
          <h1 className="text-xl font-semibold">Change your password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Use 12+ characters with uppercase, lowercase, number and symbol.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            ["currentPassword", "Current password"],
            ["newPassword", "New password"],
            ["confirmPassword", "Confirm new password"],
          ].map(([name, label]) => (
            <div key={name}>
              <label htmlFor={name} className="mb-2 block text-sm font-medium">{label}</label>
              <input
                id={name}
                name={name}
                type="password"
                autoComplete={name === "currentPassword" ? "current-password" : "new-password"}
                required
                className="h-11 w-full rounded-lg border bg-background px-3.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          ))}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="h-11 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>
    </main>
  );
}
