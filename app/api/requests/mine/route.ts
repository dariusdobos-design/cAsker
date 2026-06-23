import { NextResponse } from "next/server";
import { fetchCustomerRequestsWithResponses } from "@/lib/customer-request-responses";
import { mapCustomerRequestForMobile } from "@/lib/map-customer-request-for-mobile";

export async function POST(request: Request) {
  let body: { ids?: unknown };

  try {
    body = (await request.json()) as { ids?: unknown };
  } catch {
    return NextResponse.json({ error: "Neplatné JSON telo požiadavky." }, { status: 400 });
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ requests: [] });
  }

  try {
    const requests = await fetchCustomerRequestsWithResponses(ids);
    return NextResponse.json({
      requests: requests.map(mapCustomerRequestForMobile),
    });
  } catch (error) {
    console.error("[api/requests/mine]", error);
    return NextResponse.json(
      { error: "Dopyty sa nepodarilo načítať." },
      { status: 500 },
    );
  }
}
