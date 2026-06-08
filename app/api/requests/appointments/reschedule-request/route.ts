import { NextResponse } from "next/server";
import { setRequestRescheduleRequested } from "@/lib/requests";

export async function POST(request: Request) {
  let body: { requestId?: unknown };

  try {
    body = (await request.json()) as { requestId?: unknown };
  } catch {
    return NextResponse.json({ error: "Neplatné JSON telo požiadavky." }, { status: 400 });
  }

  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  if (!requestId) {
    return NextResponse.json({ error: "Chýba ID dopytu." }, { status: 400 });
  }

  try {
    const rescheduleRequestedAt = await setRequestRescheduleRequested(requestId);
    return NextResponse.json({ ok: true, rescheduleRequestedAt });
  } catch (error) {
    console.error("[api/requests/appointments/reschedule-request]", error);
    const message =
      error instanceof Error ? error.message : "Žiadosť o zmenu termínu sa nepodarilo odoslať.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
