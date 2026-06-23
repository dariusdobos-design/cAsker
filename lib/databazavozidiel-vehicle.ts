import { formatEngineVolumeFromCc } from "@/lib/engine-volume";
import { isValidEcv, normalizeEcv } from "@/lib/stkonline-vehicle";

const DATABAZAVOZIDIEL_API_URL = "https://www.databazavozidiel.sk/api/vehicles";
const DATABAZAVOZIDIEL_API_VERSION = "3";
const FETCH_TIMEOUT_MS = 12_000;

export type DatabazaVozidielVehicleRecord = {
  ecv?: string;
  znacka?: string;
  obch_nazov?: string;
  vin?: string;
  druh_paliva?: string;
  farba?: string;
  vykon?: string | number;
  objem?: string | number;
  prevodovka?: string;
  dat_prva_evid?: string;
  dat_prva_evid_sr?: string;
  druh_karoserie?: string;
  kategoria?: string;
  cislo_motora?: string | null;
};

type DatabazaVozidielApiV3Response = {
  vehicle?: DatabazaVozidielVehicleRecord;
};

type DatabazaVozidielApiErrorResponse = {
  message?: string;
};

export type DatabazaVozidielVehicleLookupResult = {
  ecv: string;
  znacka: string;
  model: string;
  vin: string;
  palivo: string;
  farba: string;
  objemMotora: string;
  vykon: string;
  prevodovka: string;
  rok: number | null;
  karoseria: string;
  motor: string;
};

export class DatabazaVozidielVehicleLookupError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NOT_CONFIGURED"
      | "NOT_FOUND"
      | "UPSTREAM_UNAVAILABLE"
      | "PARSE_FAILED"
      | "IP_NOT_AUTHORIZED"
      | "QUOTA_EXCEEDED",
  ) {
    super(message);
    this.name = "DatabazaVozidielVehicleLookupError";
  }
}

function getApiToken() {
  return process.env.DATABAZAVOZIDIEL_API_TOKEN?.trim() ?? "";
}

export function isDatabazaVozidielConfigured() {
  return getApiToken().length > 0;
}

function parseYearFromDate(value?: string) {
  if (!value) {
    return null;
  }

  const dotted = value.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dotted) {
    return Number.parseInt(dotted[3], 10);
  }

  const iso = value.match(/(\d{4})/);
  if (!iso) {
    return null;
  }

  const year = Number.parseInt(iso[1], 10);
  return Number.isFinite(year) ? year : null;
}

function formatPower(value?: string | number) {
  if (value === null || value === undefined) {
    return "";
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return "";
  }

  if (/kW|kw|hp/i.test(trimmed)) {
    return trimmed;
  }

  const numeric = Number.parseInt(trimmed, 10);
  if (Number.isFinite(numeric) && numeric > 0) {
    return `${numeric} kW`;
  }

  return trimmed;
}

function formatPrevodovka(value?: string) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return "";
  }

  const normalized = trimmed.toUpperCase();
  if (normalized === "MT" || normalized === "M/T") {
    return "Manuálna";
  }

  if (normalized === "AT" || normalized === "A/T" || normalized === "AUT") {
    return "Automatická";
  }

  return trimmed;
}

function mapVehicleRecord(
  ecv: string,
  record: DatabazaVozidielVehicleRecord,
): DatabazaVozidielVehicleLookupResult {
  return {
    ecv: record.ecv?.trim() || ecv,
    znacka: record.znacka?.trim() ?? "",
    model: record.obch_nazov?.trim() ?? "",
    vin: record.vin?.trim() ?? "",
    palivo: record.druh_paliva?.trim() ?? "",
    farba: record.farba?.trim() ?? "",
    objemMotora: formatEngineVolumeFromCc(record.objem),
    vykon: formatPower(record.vykon),
    prevodovka: formatPrevodovka(record.prevodovka),
    rok: parseYearFromDate(record.dat_prva_evid),
    karoseria: record.druh_karoserie?.trim() ?? "",
    motor: record.cislo_motora?.trim() ?? "",
  };
}

function parseLegacyApiPayload(payload: unknown): DatabazaVozidielVehicleRecord | null {
  if (!Array.isArray(payload) || payload.length < 2) {
    return null;
  }

  const [success, data] = payload;
  if (success === false) {
    const message = typeof data === "string" ? data : "Vyhľadávanie zlyhalo.";
    if (/ip is not authorized/i.test(message)) {
      throw new DatabazaVozidielVehicleLookupError(
        "IP adresa servera nie je povolená v DatabázaVozidiel.sk. Použite API v3 s Bearer tokenom alebo kontaktujte podporu.",
        "IP_NOT_AUTHORIZED",
      );
    }

    if (/not found|nenajden|nenájden/i.test(message)) {
      throw new DatabazaVozidielVehicleLookupError(
        "Vozidlo s uvedeným evidenčným číslom sa v registri nenašlo.",
        "NOT_FOUND",
      );
    }

    throw new DatabazaVozidielVehicleLookupError(message, "UPSTREAM_UNAVAILABLE");
  }

  if (!data || typeof data !== "object") {
    return null;
  }

  return data as DatabazaVozidielVehicleRecord;
}

function parseApiPayload(payload: unknown): DatabazaVozidielVehicleRecord {
  if (payload && typeof payload === "object" && "vehicle" in payload) {
    const vehicle = (payload as DatabazaVozidielApiV3Response).vehicle;
    if (vehicle && typeof vehicle === "object") {
      return vehicle;
    }
  }

  const legacy = parseLegacyApiPayload(payload);
  if (legacy) {
    return legacy;
  }

  throw new DatabazaVozidielVehicleLookupError(
    "Nepodarilo sa spracovať odpoveď DatabázaVozidiel.sk.",
    "PARSE_FAILED",
  );
}

function mapHttpError(status: number, payload: DatabazaVozidielApiErrorResponse) {
  const message = payload.message?.trim() ?? "";

  if (status === 401) {
    throw new DatabazaVozidielVehicleLookupError(
      message ||
        "API kľúč nie je autorizovaný. Skontrolujte DATABAZAVOZIDIEL_API_TOKEN.",
      "IP_NOT_AUTHORIZED",
    );
  }

  if (status === 404) {
    throw new DatabazaVozidielVehicleLookupError(
      message || "Vozidlo s uvedeným evidenčným číslom sa v registri nenašlo.",
      "NOT_FOUND",
    );
  }

  if (status === 429) {
    throw new DatabazaVozidielVehicleLookupError(
      "Vyčerpaný limit API volaní v DatabázaVozidiel.sk. Dobite kredit v portáli alebo počkajte na obnovu balíka.",
      "QUOTA_EXCEEDED",
    );
  }

  throw new DatabazaVozidielVehicleLookupError(
    message || `DatabázaVozidiel.sk vrátila chybu (${status}).`,
    "UPSTREAM_UNAVAILABLE",
  );
}

export async function fetchVehicleByEcvFromDatabazaVozidiel(
  rawEcv: string,
): Promise<DatabazaVozidielVehicleLookupResult> {
  const token = getApiToken();
  if (!token) {
    throw new DatabazaVozidielVehicleLookupError(
      "Chýba DATABAZAVOZIDIEL_API_TOKEN v prostredí servera.",
      "NOT_CONFIGURED",
    );
  }

  const ecv = normalizeEcv(rawEcv);
  if (!isValidEcv(ecv)) {
    throw new DatabazaVozidielVehicleLookupError(
      "Neplatné evidenčné číslo vozidla (EČV).",
      "UPSTREAM_UNAVAILABLE",
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const url = `${DATABAZAVOZIDIEL_API_URL}?ecv=${encodeURIComponent(ecv)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Version: DATABAZAVOZIDIEL_API_VERSION,
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new DatabazaVozidielVehicleLookupError(
        "Časový limit pri načítaní údajov z DatabázaVozidiel.sk vypršal.",
        "UPSTREAM_UNAVAILABLE",
      );
    }

    throw new DatabazaVozidielVehicleLookupError(
      "Nepodarilo sa spojiť s DatabázaVozidiel.sk.",
      "UPSTREAM_UNAVAILABLE",
    );
  } finally {
    clearTimeout(timeoutId);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new DatabazaVozidielVehicleLookupError(
      "Nepodarilo sa spracovať odpoveď DatabázaVozidiel.sk.",
      "PARSE_FAILED",
    );
  }

  if (!response.ok) {
    mapHttpError(response.status, payload as DatabazaVozidielApiErrorResponse);
  }

  const record = parseApiPayload(payload);
  const mapped = mapVehicleRecord(ecv, record);

  if (!mapped.znacka && !mapped.model && !mapped.vin) {
    throw new DatabazaVozidielVehicleLookupError(
      "Vozidlo s uvedeným evidenčným číslom sa v registri nenašlo.",
      "NOT_FOUND",
    );
  }

  return mapped;
}
