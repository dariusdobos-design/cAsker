import { NextResponse } from "next/server";
import { removeRequestFromServiceDashboard } from "@/lib/request-service-declines";
import { fetchRequestById } from "@/lib/requests";

export async function POST(request: Request) {
  let body: { requestId?: unknown; companyId?: unknown; companyName?: unknown };

  try {
    body = (await request.json()) as {
      requestId?: unknown;
      companyId?: unknown;
      companyName?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "Neplatné JSON telo požiadavky." }, { status: 400 });
  }

  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  const companyId = typeof body.companyId === "string" ? body.companyId.trim() : "";

  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";

  if (!requestId) {
    return NextResponse.json({ error: "Chýba ID dopytu." }, { status: 400 });
  }

  if (!companyId) {
    return NextResponse.json({ error: "Chýba ID servisu." }, { status: 400 });
  }

  try {
    const existing = await fetchRequestById(requestId);
    if (!existing) {
      return NextResponse.json({ error: "Dopyt sa nenašiel." }, { status: 404 });
    }

    await removeRequestFromServiceDashboard(existing, companyId, companyName);
    const refreshed = await fetchRequestById(requestId);
    return NextResponse.json({ ok: true, request: refreshed });
  } catch (error) {
    console.error("[api/requests/decline-for-service]", error);
    const message =
      error instanceof Error ? error.message : "Dopyt sa nepodarilo odmietnuť.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
