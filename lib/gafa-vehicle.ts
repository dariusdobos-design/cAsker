import { formatEngineVolumeFromCc } from "@/lib/engine-volume";
import { normalizeEcv } from "@/lib/stkonline-vehicle";

const GAFA_PLATE_LOOKUP_URL =
  "https://www.autodielygafa.sk/server/api/databazavozidiel/getvehiclebyplatenumber";
const FETCH_TIMEOUT_MS = 12_000;

export type GafaVehicleLookupResult = {
  ecv: string;
  vin: string;
  znacka: string;
  model: string;
  motor: string;
  objemMotora: string;
  vykon: string;
  rokVyroby: string;
  rokVyrobyOd: number | null;
  pohon: string;
  palivo: string;
  variantCount: number;
};

type GafaEngine = {
  mCode?: string;
};

type GafaVehicleType = {
  id?: number;
  ccm?: number;
  ps?: number;
  kw?: number;
  fuelType?: string;
  driveType?: string;
  manufactureFrom?: string;
  manufactureTo?: string;
  engines?: GafaEngine[];
  vehicleModel?: {
    name?: string;
    manufacturer?: {
      name?: string;
    };
  };
};

type GafaPlateLookupResponse = {
  vin?: string;
  vehicleTypes?: GafaVehicleType[];
};

export class GafaVehicleLookupError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "UPSTREAM_UNAVAILABLE" | "PARSE_FAILED",
  ) {
    super(message);
    this.name = "GafaVehicleLookupError";
  }
}

function formatEngineVolume(ccm?: number) {
  return formatEngineVolumeFromCc(ccm);
}

function formatPower(kw?: number, ps?: number) {
  if (kw && kw > 0) {
    return `${kw} kW`;
  }

  if (ps && ps > 0) {
    return `${ps} hp`;
  }

  return "";
}

function parseYearFromDate(value?: string) {
  if (!value) {
    return null;
  }

  const match = value.match(/(\d{4})/);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  return Number.isFinite(year) ? year : null;
}

function formatYearRange(from?: string, to?: string) {
  const fromYear = parseYearFromDate(from);
  const toYear = parseYearFromDate(to);

  if (fromYear && toYear) {
    return `${fromYear} – ${toYear}`;
  }

  if (fromYear) {
    return String(fromYear);
  }

  if (toYear) {
    return String(toYear);
  }

  return "";
}

function pickBestVehicleType(types: GafaVehicleType[]) {
  return types[0];
}

function mapGafaVehicle(ecv: string, payload: GafaPlateLookupResponse): GafaVehicleLookupResult {
  const types = payload.vehicleTypes ?? [];
  if (types.length === 0) {
    throw new GafaVehicleLookupError(
      "Vozidlo s uvedeným evidenčným číslom sa nenašlo v katalógu dielov.",
      "NOT_FOUND",
    );
  }

  const selected = pickBestVehicleType(types);
  const znacka = selected.vehicleModel?.manufacturer?.name?.trim() ?? "";
  const model = selected.vehicleModel?.name?.trim() ?? "";
  const engineCodes =
    selected.engines?.map((engine) => engine.mCode?.trim()).filter(Boolean).join(", ") ?? "";

  return {
    ecv,
    vin: payload.vin?.trim() ?? "",
    znacka,
    model,
    motor: engineCodes,
    objemMotora: formatEngineVolume(selected.ccm),
    vykon: formatPower(selected.kw, selected.ps),
    rokVyroby: formatYearRange(selected.manufactureFrom, selected.manufactureTo),
    rokVyrobyOd: parseYearFromDate(selected.manufactureTo) ?? parseYearFromDate(selected.manufactureFrom),
    pohon: selected.driveType?.trim() ?? "",
    palivo: selected.fuelType?.trim() ?? "",
    variantCount: types.length,
  };
}

export async function fetchVehicleByEcvFromGafa(rawEcv: string): Promise<GafaVehicleLookupResult> {
  const ecv = normalizeEcv(rawEcv);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    const url = `${GAFA_PLATE_LOOKUP_URL}?plateNumber=${encodeURIComponent(ecv)}`;
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        Referer: "https://www.autodielygafa.sk/",
        Origin: "https://www.autodielygafa.sk",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new GafaVehicleLookupError(
        "Časový limit pri načítaní údajov z katalógu vozidiel vypršal.",
        "UPSTREAM_UNAVAILABLE",
      );
    }

    throw new GafaVehicleLookupError(
      "Nepodarilo sa spojiť s katalógom vozidiel.",
      "UPSTREAM_UNAVAILABLE",
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 404) {
    throw new GafaVehicleLookupError(
      "Vozidlo s uvedeným evidenčným číslom sa nenašlo v katalógu dielov.",
      "NOT_FOUND",
    );
  }

  if (!response.ok) {
    throw new GafaVehicleLookupError(
      `Katalóg vozidiel vrátil chybu (${response.status}).`,
      "UPSTREAM_UNAVAILABLE",
    );
  }

  let payload: GafaPlateLookupResponse;
  try {
    payload = (await response.json()) as GafaPlateLookupResponse;
  } catch {
    throw new GafaVehicleLookupError(
      "Nepodarilo sa spracovať odpoveď katalógu vozidiel.",
      "PARSE_FAILED",
    );
  }

  return mapGafaVehicle(ecv, payload);
}
