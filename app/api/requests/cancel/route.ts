import { NextResponse } from "next/server";
import { cancelRequest, fetchRequestById } from "@/lib/requests";

export async function POST(request: Request) {
  let body: { id?: unknown };

  try {
    body = (await request.json()) as { id?: unknown };
  } catch {
    return NextResponse.json({ error: "Neplatné JSON telo požiadavky." }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "Chýba ID dopytu." }, { status: 400 });
  }

  try {
    const existing = await fetchRequestById(id);
    if (!existing) {
      return NextResponse.json({ error: "Dopyt sa nenašiel." }, { status: 404 });
    }

    if (
      existing.status === "cancelled" ||
      existing.status === "completed" ||
      existing.status === "expired"
    ) {
      return NextResponse.json(
        { error: "Tento dopyt už nie je možné zrušiť." },
        { status: 400 },
      );
    }

    await cancelRequest(existing, { reason: "customer" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/requests/cancel]", error);
    const message =
      error instanceof Error ? error.message : "Dopyt sa nepodarilo zrušiť.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
