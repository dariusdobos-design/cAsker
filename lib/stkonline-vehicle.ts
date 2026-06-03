import * as cheerio from "cheerio";

const STK_ONLINE_BASE = "https://stkonline.sk/spz";
const FETCH_TIMEOUT_MS = 12_000;
const NOT_FOUND_MARKER = "sa v databáze nenachádza";

export type VehicleLookupResult = {
  ecv: string;
  znacka: string;
  model: string;
  vin: string;
  palivo: string;
  farba: string;
};

export class VehicleLookupError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_ECV"
      | "NOT_FOUND"
      | "UPSTREAM_UNAVAILABLE"
      | "PARSE_FAILED",
  ) {
    super(message);
    this.name = "VehicleLookupError";
  }
}

export function normalizeEcv(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

export function isValidEcv(value: string) {
  return /^[A-Z0-9]{2,10}$/.test(value);
}

function decodeText(value: string) {
  return cheerio.load(`<div>${value}</div>`).text().trim();
}

function normalizeLabel(value: string) {
  return decodeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function extractValueByLabels($: cheerio.CheerioAPI, labels: string[]) {
  const wanted = labels.map((label) => normalizeLabel(label));
  let found = "";

  $("span.label").each((_, element) => {
    const labelText = normalizeLabel($(element).text());
    const matches = wanted.some(
      (target) => labelText === target || labelText.includes(target),
    );
    if (!matches) return;

    const parent = $(element).parent();
    const valueElement = parent.find("h4, h2").first();
    if (!valueElement.length) return;

    found = decodeText(valueElement.text());
    return false;
  });

  return found;
}

function pageIndicatesNotFound($: cheerio.CheerioAPI) {
  const alertText = $(".alert-danger").text();
  if (alertText.includes(NOT_FOUND_MARKER)) return true;

  const bodyText = $("body").text();
  return bodyText.includes(NOT_FOUND_MARKER);
}

function parseVehicleHtml(html: string, ecv: string): VehicleLookupResult {
  const $ = cheerio.load(html);

  if (pageIndicatesNotFound($)) {
    throw new VehicleLookupError(
      "Vozidlo s uvedeným evidenčným číslom sa v databáze nenachádza.",
      "NOT_FOUND",
    );
  }

  const znacka = extractValueByLabels($, ["Značka vozidla", "Značka"]);
  const model = extractValueByLabels($, ["Model"]);
  const vin = extractValueByLabels($, ["VIN"]);
  const palivo = extractValueByLabels($, ["Palivo"]);
  const farba = extractValueByLabels($, ["Farba"]);

  if (!znacka && !model && !vin) {
    throw new VehicleLookupError(
      "Nepodarilo sa načítať údaje o vozidle zo zdrojovej stránky.",
      "PARSE_FAILED",
    );
  }

  return {
    ecv,
    znacka,
    model,
    vin,
    palivo,
    farba,
  };
}

export async function fetchVehicleByEcv(rawEcv: string): Promise<VehicleLookupResult> {
  const ecv = normalizeEcv(rawEcv);
  if (!isValidEcv(ecv)) {
    throw new VehicleLookupError(
      "Neplatné evidenčné číslo vozidla (EČV).",
      "INVALID_ECV",
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${STK_ONLINE_BASE}/${encodeURIComponent(ecv)}`, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "sk",
        "User-Agent": "cAsker-VehicleLookup/1.0",
      },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new VehicleLookupError(
        "Časový limit pri načítaní údajov o vozidle vypršal.",
        "UPSTREAM_UNAVAILABLE",
      );
    }

    throw new VehicleLookupError(
      "Nepodarilo sa spojiť so zdrojom údajov o vozidle.",
      "UPSTREAM_UNAVAILABLE",
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new VehicleLookupError(
      `Zdroj údajov vrátil chybu (${response.status}).`,
      "UPSTREAM_UNAVAILABLE",
    );
  }

  const html = await response.text();
  return parseVehicleHtml(html, ecv);
}
