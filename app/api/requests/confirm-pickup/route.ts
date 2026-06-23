import { NextResponse } from "next/server";
import { confirmCustomerPickup } from "@/lib/requests";

export async function POST(request: Request) {
  let body: { requestId?: unknown };

  try {
    body = (await request.json()) as { requestId?: unknown };
  } catch {
    return NextResponse.json({ error: "Neplatné JSON telo požiadavky." }, { status: 400 });
  }

  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";

  if (!requestId) {
    return NextResponse.json({ error: "Chýba requestId." }, { status: 400 });
  }

  try {
    await confirmCustomerPickup(requestId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/requests/confirm-pickup]", error);
    const message =
      error instanceof Error ? error.message : "Prevzatie vozidla sa nepodarilo potvrdiť.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
