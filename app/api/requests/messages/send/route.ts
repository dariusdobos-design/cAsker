import { NextResponse } from "next/server";
import { sendRequestMessage, type RequestMessageSenderRole } from "@/lib/request-messages";

function isSenderRole(value: unknown): value is RequestMessageSenderRole {
  return value === "service" || value === "customer";
}

export async function POST(request: Request) {
  let body: { requestId?: unknown; text?: unknown; senderRole?: unknown };

  try {
    body = (await request.json()) as {
      requestId?: unknown;
      text?: unknown;
      senderRole?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "Neplatné JSON telo požiadavky." }, { status: 400 });
  }

  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  const text = typeof body.text === "string" ? body.text : "";
  const senderRole = body.senderRole;

  if (!requestId) {
    return NextResponse.json({ error: "Chýba requestId." }, { status: 400 });
  }

  if (!isSenderRole(senderRole)) {
    return NextResponse.json({ error: "Neplatný senderRole." }, { status: 400 });
  }

  try {
    const message = await sendRequestMessage(requestId, senderRole, text);
    return NextResponse.json({ message });
  } catch (error) {
    console.error("[api/requests/messages/send]", error);
    const message = error instanceof Error ? error.message : "Správu sa nepodarilo odoslať.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
