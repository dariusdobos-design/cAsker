function getApiBaseUrl() {
  const base = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, "");
  if (!base) {
    throw new Error(
      "Chýba EXPO_PUBLIC_API_URL. V mobile-app/.env nastavte URL Next.js servera.",
    );
  }
  return base;
}

export type VehicleLookupResult = {
  ecv: string;
  znacka: string;
  model: string;
  vin: string;
  palivo: string;
  farba: string;
  motor?: string;
  objemMotora?: string;
  vykon?: string;
  rokVyroby?: string;
  rok?: number | null;
  pohon?: string;
  prevodovka?: string;
  sources?: Array<"stkonline" | "databazavozidiel" | "gafa">;
  variantCount?: number;
  lookupWarning?: string;
};

export type VehicleLookupErrorCode =
  | "INVALID_ECV"
  | "NOT_FOUND"
  | "UPSTREAM_UNAVAILABLE"
  | "PARSE_FAILED"
  | "NETWORK";

export class VehicleLookupApiError extends Error {
  constructor(
    message: string,
    public readonly code: VehicleLookupErrorCode,
  ) {
    super(message);
    this.name = "VehicleLookupApiError";
  }
}

export function normalizeLicensePlate(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

export function formatLicensePlateDisplay(value: string) {
  const normalized = normalizeLicensePlate(value);
  if (normalized.length <= 2) {
    return normalized;
  }

  const district = normalized.slice(0, 2);
  const rest = normalized.slice(2);
  return `${district} ${rest}`;
}

export async function lookupVehicleByPlate(rawPlate: string): Promise<VehicleLookupResult> {
  const ecv = normalizeLicensePlate(rawPlate);
  if (!ecv) {
    throw new VehicleLookupApiError("Zadajte evidenčné číslo vozidla.", "INVALID_ECV");
  }

  const base = getApiBaseUrl();
  let response: Response;

  try {
    response = await fetch(`${base}/api/vehicle?ecv=${encodeURIComponent(ecv)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new VehicleLookupApiError(
      "Nepodarilo sa spojiť so serverom. Skontrolujte EXPO_PUBLIC_API_URL.",
      "NETWORK",
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | VehicleLookupResult
    | { error?: string; code?: VehicleLookupErrorCode }
    | null;

  if (!response.ok) {
    const message =
      payload && "error" in payload && payload.error
        ? payload.error
        : "Nepodarilo sa načítať údaje o vozidle.";
    const code =
      payload && "code" in payload && payload.code ? payload.code : "UPSTREAM_UNAVAILABLE";
    throw new VehicleLookupApiError(message, code);
  }

  if (!payload || !("ecv" in payload)) {
    throw new VehicleLookupApiError(
      "Nepodarilo sa spracovať odpoveď servera.",
      "PARSE_FAILED",
    );
  }

  return payload;
}
