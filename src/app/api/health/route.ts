import { NextResponse } from "next/server";

/** Simple uptime check for Unraid / reverse-proxy debugging. */
export async function GET() {
  return NextResponse.json({ ok: true, service: "recipe-book" });
}
