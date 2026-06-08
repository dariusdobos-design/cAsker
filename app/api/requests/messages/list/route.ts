import { NextResponse } from "next/server";
import { fetchRequestMessages } from "@/lib/request-messages";

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
    const messages = await fetchRequestMessages(requestId);
    return NextResponse.json({ messages });
  } catch (error) {
    console.error("[api/requests/messages/list]", error);
    return NextResponse.json({ error: "Správy sa nepodarilo načítať." }, { status: 500 });
  }
}
