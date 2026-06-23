import { NextResponse } from "next/server";
import { expireUnansweredInquiries } from "@/lib/expire-unanswered-inquiries";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Neautorizované." }, { status: 401 });
  }

  try {
    const result = await expireUnansweredInquiries();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[api/cron/expire-inquiries]", error);
    const message =
      error instanceof Error ? error.message : "Dopyty sa nepodarilo expirovať.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
