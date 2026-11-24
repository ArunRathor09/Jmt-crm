"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { enableTotpAction } from "@/src/features/auth/totp-actions";

export function TotpSetupForm({ secret }: { secret: string }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const result = await enableTotpAction(secret, token);
    if (result.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6">
      <label htmlFor="totp" className="mb-2 block text-sm font-medium">Authentication code</label>
      <input
        id="totp"
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        value={token}
        onChange={(event) => setToken(event.target.value.replace(/\D/g, ""))}
        required
        autoComplete="one-time-code"
        className="h-12 w-full rounded-lg border bg-background px-4 text-center font-mono text-xl tracking-[0.45em] outline-none focus:ring-2 focus:ring-ring"
        placeholder="000000"
      />
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={loading || token.length !== 6}
        className="mt-4 h-11 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {loading ? "Verifying..." : "Verify and enable"}
      </button>
    </form>
  );
}
