import { NextResponse } from "next/server";
import {
  createDriverInquiry,
  type DriverInquiryInput,
} from "@/lib/create-driver-inquiry";
import type { RequestCategory } from "@/lib/requests";

function parseRequestCategory(value: unknown): RequestCategory | null {
  if (value === "auto" || value === "tire" || value === "towing") {
    return value;
  }
  return null;
}

export async function POST(request: Request) {
  let body: Partial<DriverInquiryInput>;

  try {
    body = (await request.json()) as Partial<DriverInquiryInput>;
  } catch {
    return NextResponse.json({ error: "Neplatné JSON telo požiadavky." }, { status: 400 });
  }

  const requestCategory = parseRequestCategory(body.requestCategory);
  const licensePlate = typeof body.licensePlate === "string" ? body.licensePlate : "";
  const vehicleName = typeof body.vehicleName === "string" ? body.vehicleName : "";
  const vehicleTitle = typeof body.vehicleTitle === "string" ? body.vehicleTitle : vehicleName;
  const locationCity = typeof body.locationCity === "string" ? body.locationCity : "";
  const description = typeof body.description === "string" ? body.description : "";
  const radiusKm =
    typeof body.radiusKm === "number" && Number.isFinite(body.radiusKm) ? body.radiusKm : 50;

  if (!requestCategory) {
    return NextResponse.json({ error: "Chýba alebo je neplatná kategória dopytu." }, { status: 400 });
  }

  if (!licensePlate.trim()) {
    return NextResponse.json({ error: "Chýba EČV vozidla." }, { status: 400 });
  }

  if (!vehicleName.trim()) {
    return NextResponse.json({ error: "Chýba názov vozidla." }, { status: 400 });
  }

  try {
    const created = await createDriverInquiry({
      requestCategory,
      licensePlate,
      vehicleName,
      vehicleTitle,
      locationCity,
      radiusKm,
      description,
      latitude: typeof body.latitude === "number" ? body.latitude : undefined,
      longitude: typeof body.longitude === "number" ? body.longitude : undefined,
      userName: typeof body.userName === "string" ? body.userName : undefined,
      phone: typeof body.phone === "string" ? body.phone : undefined,
      vehicleSpecs:
        body.vehicleSpecs && typeof body.vehicleSpecs === "object"
          ? body.vehicleSpecs
          : undefined,
      targetCompanyId:
        typeof body.targetCompanyId === "string" ? body.targetCompanyId : undefined,
      targetCompanyName:
        typeof body.targetCompanyName === "string" ? body.targetCompanyName : undefined,
      photos: Array.isArray(body.photos) ? body.photos : undefined,
    });

    return NextResponse.json({ request: created }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Dopyt sa nepodarilo uložiť.";
    console.error("[api/requests/inquiry]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
