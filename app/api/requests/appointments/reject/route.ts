import { NextResponse } from "next/server";
import { rejectCustomerAppointment } from "@/lib/appointments";

export async function POST(request: Request) {
  let body: { appointmentId?: unknown };

  try {
    body = (await request.json()) as { appointmentId?: unknown };
  } catch {
    return NextResponse.json({ error: "Neplatné JSON telo požiadavky." }, { status: 400 });
  }

  const appointmentId = typeof body.appointmentId === "string" ? body.appointmentId.trim() : "";
  if (!appointmentId) {
    return NextResponse.json({ error: "Chýba ID ponuky." }, { status: 400 });
  }

  try {
    const requestId = await rejectCustomerAppointment(appointmentId);
    return NextResponse.json({ ok: true, requestId });
  } catch (error) {
    console.error("[api/requests/appointments/reject]", error);
    const message =
      error instanceof Error ? error.message : "Ponuku sa nepodarilo odmietnuť.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
