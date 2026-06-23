import { NextResponse } from "next/server";
import { lookupVehicleByEcv } from "@/lib/vehicle-lookup";
import { VehicleLookupError } from "@/lib/stkonline-vehicle";
import { DatabazaVozidielVehicleLookupError } from "@/lib/databazavozidiel-vehicle";
import { GafaVehicleLookupError } from "@/lib/gafa-vehicle";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ecv = searchParams.get("ecv") ?? searchParams.get("spz") ?? "";

  if (!ecv.trim()) {
    return NextResponse.json(
      { error: "Chýba parameter EČV (ecv alebo spz)." },
      { status: 400 },
    );
  }

  try {
    const vehicle = await lookupVehicleByEcv(ecv);
    return NextResponse.json(vehicle);
  } catch (error) {
    if (
      error instanceof VehicleLookupError ||
      error instanceof GafaVehicleLookupError ||
      error instanceof DatabazaVozidielVehicleLookupError
    ) {
      const status =
        error.code === "INVALID_ECV"
          ? 400
          : error.code === "NOT_FOUND"
            ? 404
            : error.code === "PARSE_FAILED"
              ? 502
              : 503;

      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }

    console.error("[api/vehicle] Unexpected error:", error);
    return NextResponse.json(
      { error: "Interná chyba pri načítaní údajov o vozidle." },
      { status: 500 },
    );
  }
}
