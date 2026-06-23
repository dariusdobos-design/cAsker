import { NextResponse } from "next/server";
import { countUnreadRequestMessagesForService } from "@/lib/request-messages";

export async function POST(request: Request) {
  let body: { requestIds?: unknown };

  try {
    body = (await request.json()) as { requestIds?: unknown };
  } catch {
    return NextResponse.json({ error: "Neplatné JSON telo požiadavky." }, { status: 400 });
  }

  const requestIds = Array.isArray(body.requestIds)
    ? body.requestIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];

  try {
    const counts = await countUnreadRequestMessagesForService(requestIds);
    const unreadByRequestId: Record<string, number> = {};

    for (const requestId of requestIds) {
      unreadByRequestId[requestId] = 0;
    }

    for (const [requestId, count] of counts) {
      unreadByRequestId[requestId] = count;
    }

    return NextResponse.json({ unreadByRequestId });
  } catch (error) {
    console.error("[api/requests/messages/unread-counts]", error);
    return NextResponse.json(
      { error: "Neprečítané správy sa nepodarilo načítať." },
      { status: 500 },
    );
  }
}
