import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "jmt-crm",
    timestamp: new Date().toISOString(),
  });
}
