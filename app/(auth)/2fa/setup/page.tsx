import Image from "next/image";
import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { generateSecret, generateURI } from "otplib";
import { getSession } from "@/src/lib/auth/session";
import { TotpSetupForm } from "./totp-form";

export const instant = false;

export default async function TotpSetupPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "SUPER_ADMIN") redirect("/dashboard");
  if (session.twoFactorEnabled) redirect("/dashboard");

  const secret = generateSecret();
  const uri = generateURI({
    issuer: "JMT CRM",
    label: session.email,
    secret,
  });
  const qrDataUrl = await QRCode.toDataURL(uri, { width: 220, margin: 1 });

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl border bg-white">
            <Image src="/assets/logo.svg" alt="JMT" width={44} height={44} className="h-11 w-11 object-contain" />
          </div>
          <div>
            <p className="font-semibold">JMT CRM</p>
            <p className="text-xs text-muted-foreground">Super Admin security setup</p>
          </div>
        </div>
        <h1 className="text-xl font-semibold">Set up two-factor authentication</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Scan this QR code with Google Authenticator or Authy, then enter the 6-digit code.
        </p>
        <div className="mt-6 grid gap-6 sm:grid-cols-[220px_1fr] sm:items-center">
          <div className="mx-auto rounded-xl border bg-white p-3">
            <Image src={qrDataUrl} alt="TOTP QR code" width={220} height={220} unoptimized />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Manual setup key</p>
            <code className="mt-2 block break-all rounded-lg border bg-muted px-3 py-2 text-sm">{secret}</code>
          </div>
        </div>
        <TotpSetupForm secret={secret} />
      </div>
    </main>
  );
}
