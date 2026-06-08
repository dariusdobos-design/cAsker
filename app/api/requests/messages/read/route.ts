import { NextResponse } from "next/server";
import {
  markRequestMessagesReadByCustomer,
  markRequestMessagesReadByService,
} from "@/lib/request-messages";

export async function POST(request: Request) {
  let body: { requestId?: unknown; reader?: unknown };

  try {
    body = (await request.json()) as { requestId?: unknown; reader?: unknown };
  } catch {
    return NextResponse.json({ error: "Neplatné JSON telo požiadavky." }, { status: 400 });
  }

  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  const reader = body.reader;

  if (!requestId) {
    return NextResponse.json({ error: "Chýba requestId." }, { status: 400 });
  }

  try {
    if (reader === "customer") {
      await markRequestMessagesReadByCustomer(requestId);
    } else if (reader === "service") {
      await markRequestMessagesReadByService(requestId);
    } else {
      return NextResponse.json({ error: "Neplatný reader." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/requests/messages/read]", error);
    return NextResponse.json({ error: "Stav prečítania sa nepodarilo uložiť." }, { status: 500 });
  }
}
