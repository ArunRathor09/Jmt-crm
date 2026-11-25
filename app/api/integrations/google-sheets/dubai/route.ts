import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "@/src/lib/env";
import { syncDubaiSheetRow } from "@/src/features/leads/google-sheets-sync";

const requestSchema = z
  .object({
    rows: z
      .array(
        z.object({
          rowNumber: z.number().int().positive(),
          values: z.record(z.string(), z.string()),
        }),
      )
      .min(1)
      .max(100),
  })
  .strict();

function isAuthorized(received: string | null, expected: string) {
  if (!received) return false;
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return (
    receivedBytes.length === expectedBytes.length &&
    timingSafeEqual(receivedBytes, expectedBytes)
  );
}

async function readBodyLimited(request: Request, limit: number) {
  const reader = request.body?.getReader();
  if (!reader) return "";

  const chunks: Buffer[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function POST(request: Request) {
  const secret = env.GOOGLE_SHEETS_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ error: "Google Sheets sync is not configured." }, { status: 503 });
  }
  if (!isAuthorized(request.headers.get("x-jmt-webhook-secret"), secret)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 512 * 1024) {
    return Response.json({ error: "Webhook payload exceeds 512 KB." }, { status: 413 });
  }

  const body = await readBodyLimited(request, 512 * 1024);
  if (body === null) {
    return Response.json({ error: "Webhook payload exceeds 512 KB." }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return Response.json({ error: "Webhook body must be valid JSON." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Expected 1-100 rows with a row number and string cell values.",
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const errors: { rowNumber: number; message: string }[] = [];

  for (const row of parsed.data.rows) {
    try {
      const result = await syncDubaiSheetRow(row.values);
      if (result === "created") created += 1;
      else if (result === "updated") updated += 1;
      else unchanged += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not sync this row.";
      console.error("Dubai Google Sheets lead sync failed", {
        rowNumber: row.rowNumber,
        message,
      });
      errors.push({ rowNumber: row.rowNumber, message });
    }
  }

  return Response.json(
    { created, updated, unchanged, failed: errors.length, errors },
    { status: errors.length ? 207 : 200 },
  );
}
