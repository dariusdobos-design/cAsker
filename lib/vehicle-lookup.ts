import {
  DatabazaVozidielVehicleLookupError,
  fetchVehicleByEcvFromDatabazaVozidiel,
  isDatabazaVozidielConfigured,
  type DatabazaVozidielVehicleLookupResult,
} from "@/lib/databazavozidiel-vehicle";
import {
  fetchVehicleByEcvFromGafa,
  GafaVehicleLookupError,
  type GafaVehicleLookupResult,
} from "@/lib/gafa-vehicle";
import {
  fetchVehicleByEcv,
  normalizeEcv,
  VehicleLookupError,
  type VehicleLookupResult as StkVehicleLookupResult,
} from "@/lib/stkonline-vehicle";

export type CombinedVehicleLookupResult = {
  ecv: string;
  znacka: string;
  model: string;
  vin: string;
  palivo: string;
  farba: string;
  motor: string;
  objemMotora: string;
  vykon: string;
  rokVyroby: string;
  rok: number | null;
  prevodovka: string;
  pohon: string;
  sources: Array<"stkonline" | "databazavozidiel" | "gafa">;
  variantCount: number;
  lookupWarning?: string;
};

type CacheEntry = {
  expiresAt: number;
  value: CombinedVehicleLookupResult;
};

const LOOKUP_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const LOOKUP_CACHE_VERSION = "v4";
const lookupCache = new Map<string, CacheEntry>();

function cacheKey(ecv: string) {
  return `${LOOKUP_CACHE_VERSION}:${ecv}`;
}

function pickNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return "";
}

function mergeLookupResults(
  ecv: string,
  stk: StkVehicleLookupResult | null,
  databaza: DatabazaVozidielVehicleLookupResult | null,
  gafa: GafaVehicleLookupResult | null,
): CombinedVehicleLookupResult {
  const sources: CombinedVehicleLookupResult["sources"] = [];
  if (stk) sources.push("stkonline");
  if (databaza) sources.push("databazavozidiel");
  if (gafa) sources.push("gafa");

  if (!stk && !databaza && !gafa) {
    throw new VehicleLookupError(
      "Nepodarilo sa načítať údaje o vozidle.",
      "PARSE_FAILED",
    );
  }

  const znacka = pickNonEmpty(databaza?.znacka, gafa?.znacka, stk?.znacka);
  const model = pickNonEmpty(databaza?.model, gafa?.model, stk?.model);

  return {
    ecv,
    znacka,
    model,
    vin: pickNonEmpty(databaza?.vin, gafa?.vin, stk?.vin),
    palivo: pickNonEmpty(databaza?.palivo, stk?.palivo, gafa?.palivo),
    farba: pickNonEmpty(databaza?.farba, stk?.farba),
    motor: pickNonEmpty(databaza?.motor, gafa?.motor),
    objemMotora: pickNonEmpty(databaza?.objemMotora, gafa?.objemMotora),
    vykon: pickNonEmpty(databaza?.vykon, gafa?.vykon),
    rokVyroby: gafa?.rokVyroby?.trim() ?? "",
    rok: databaza?.rok ?? gafa?.rokVyrobyOd ?? null,
    prevodovka: databaza?.prevodovka?.trim() ?? "",
    pohon: gafa?.pohon?.trim() ?? "",
    sources,
    variantCount: gafa?.variantCount ?? 0,
  };
}

export async function lookupVehicleByEcv(rawEcv: string): Promise<CombinedVehicleLookupResult> {
  const ecv = normalizeEcv(rawEcv);
  const cached = lookupCache.get(cacheKey(ecv));
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const useDatabaza = isDatabazaVozidielConfigured();

  const [stkResult, databazaResult, gafaResult] = await Promise.allSettled([
    fetchVehicleByEcv(ecv),
    useDatabaza ? fetchVehicleByEcvFromDatabazaVozidiel(ecv) : Promise.resolve(null),
    useDatabaza ? Promise.resolve(null) : fetchVehicleByEcvFromGafa(ecv),
  ]);

  let stk: StkVehicleLookupResult | null = null;
  if (stkResult.status === "fulfilled") {
    stk = stkResult.value;
  } else if (!(stkResult.reason instanceof VehicleLookupError)) {
    throw stkResult.reason;
  }

  let databaza: DatabazaVozidielVehicleLookupResult | null = null;
  let lookupWarning: string | undefined;
  if (databazaResult.status === "fulfilled") {
    databaza = databazaResult.value;
  } else if (databazaResult.reason instanceof DatabazaVozidielVehicleLookupError) {
    if (
      databazaResult.reason.code === "IP_NOT_AUTHORIZED" ||
      databazaResult.reason.code === "QUOTA_EXCEEDED"
    ) {
      lookupWarning = databazaResult.reason.message;
    }
  } else if (databazaResult.status === "rejected") {
    throw databazaResult.reason;
  }

  const gafa =
    gafaResult.status === "fulfilled"
      ? gafaResult.value
      : gafaResult.reason instanceof GafaVehicleLookupError
        ? null
        : null;

  if (!stk && !databaza && !gafa) {
    throw new VehicleLookupError(
      "Vozidlo s uvedeným evidenčným číslom sa nenašlo.",
      "NOT_FOUND",
    );
  }

  const merged = {
    ...mergeLookupResults(ecv, stk, databaza, gafa),
    ...(lookupWarning ? { lookupWarning } : {}),
  };
  lookupCache.set(cacheKey(ecv), {
    value: merged,
    expiresAt: Date.now() + LOOKUP_CACHE_TTL_MS,
  });

  return merged;
}
