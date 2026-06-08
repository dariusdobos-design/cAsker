import { NextResponse } from "next/server";

import { fetchPublicMapServices } from "@/lib/public-services";

export async function GET() {
  try {
    const services = await fetchPublicMapServices();
    return NextResponse.json({ services });
  } catch (error) {
    console.error("[api/services/map]", error);
    return NextResponse.json(
      { error: "Servisy na mape sa nepodarilo načítať." },
      { status: 500 },
    );
  }
}
