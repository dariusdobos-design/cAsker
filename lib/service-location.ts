import { isElectricVehicle, type Request } from "./requests";

export type ServiceLocation = {
  address: string;
  city: string;
  zipCode: string;
};

export type VehicleCategoryFilter = {
  car: boolean;
  van: boolean;
  electric: boolean;
  towing: boolean;
  tire: boolean;
};

export type CityCoordinates = {
  lat: number;
  lng: number;
};

export const DEFAULT_SERVICE_LOCATION: ServiceLocation = {
  address: "",
  city: "Bytča",
  zipCode: "",
};

export const DEFAULT_VEHICLE_CATEGORY_FILTER: VehicleCategoryFilter = {
  car: true,
  van: true,
  electric: true,
  towing: true,
  tire: true,
};

export function hasActiveInquiryFilter(filter: VehicleCategoryFilter) {
  return (
    filter.car ||
    filter.van ||
    filter.electric ||
    filter.towing ||
    filter.tire
  );
}

const SERVICE_LOCATION_STORAGE_KEY = "casker-service-location";
const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";

const CITY_COORDINATES: Record<string, CityCoordinates> = {
  bytca: { lat: 49.224, lng: 18.558 },
  zilina: { lat: 49.223, lng: 18.739 },
  martin: { lat: 49.066, lng: 18.923 },
  poprad: { lat: 49.061, lng: 20.298 },
  "kysucke nove mesto": { lat: 49.3, lng: 18.789 },
  rajec: { lat: 49.089, lng: 18.675 },
  namestovo: { lat: 49.407, lng: 19.481 },
  "teplicka nad vahom": { lat: 49.058, lng: 18.286 },
  "liptovsky mikulas": { lat: 49.084, lng: 19.609 },
  "liptovsky hradok": { lat: 49.039, lng: 19.723 },
  tvrdosin: { lat: 49.337, lng: 19.556 },
  cadca: { lat: 49.436, lng: 18.788 },
  rosina: { lat: 49.225, lng: 18.756 },
  "dolny kubin": { lat: 49.209, lng: 19.303 },
  ruzomberok: { lat: 49.081, lng: 19.303 },
  kosice: { lat: 48.716, lng: 21.261 },
  snina: { lat: 48.988, lng: 22.151 },
  humenne: { lat: 48.937, lng: 21.916 },
  michalovce: { lat: 48.754, lng: 21.919 },
  bratislava: { lat: 48.148, lng: 17.107 },
  presov: { lat: 48.998, lng: 21.233 },
  "banska bystrica": { lat: 48.736, lng: 19.146 },
  trencin: { lat: 48.894, lng: 18.044 },
  nitra: { lat: 48.306, lng: 18.086 },
  trnava: { lat: 48.377, lng: 17.587 },
  zvolen: { lat: 48.574, lng: 19.153 },
  prievidza: { lat: 48.774, lng: 18.623 },
  puchov: { lat: 49.124, lng: 18.326 },
  "povazska bystrica": { lat: 49.121, lng: 18.421 },
  ilava: { lat: 48.997, lng: 18.249 },
  "nove mesto nad vahom": { lat: 49.138, lng: 18.104 },
  myjava: { lat: 48.758, lng: 17.568 },
  "nemsova": { lat: 48.965, lng: 18.084 },
};

const coordinateCache = new Map<string, CityCoordinates | null>();
const geocodeQueue: Array<() => void> = [];
let geocodeQueueRunning = false;

function normalizeCityKey(city: string) {
  return city
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function haversineKm(from: CityCoordinates, to: CityCoordinates) {
  const earthRadiusKm = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function rememberCityCoordinates(city: string, coordinates: CityCoordinates | null) {
  coordinateCache.set(normalizeCityKey(city), coordinates);
}

function getCachedCityCoordinates(city: string) {
  const key = normalizeCityKey(city);
  if (!key) return undefined;

  if (Object.prototype.hasOwnProperty.call(CITY_COORDINATES, key)) {
    return CITY_COORDINATES[key];
  }

  if (coordinateCache.has(key)) {
    return coordinateCache.get(key) ?? null;
  }

  return undefined;
}

async function runGeocodeQueue() {
  if (geocodeQueueRunning) return;
  geocodeQueueRunning = true;

  while (geocodeQueue.length > 0) {
    const task = geocodeQueue.shift();
    task?.();
    await new Promise((resolve) => window.setTimeout(resolve, 1100));
  }

  geocodeQueueRunning = false;
}

function enqueueGeocode(task: () => void) {
  geocodeQueue.push(task);
  void runGeocodeQueue();
}

async function geocodeCity(city: string) {
  const trimmed = city.trim();
  const key = normalizeCityKey(trimmed);
  if (!key) return null;

  const cached = getCachedCityCoordinates(trimmed);
  if (cached !== undefined) return cached;

  try {
    const params = new URLSearchParams({
      q: `${trimmed}, Slovensko`,
      format: "json",
      limit: "1",
      countrycodes: "sk",
    });

    const response = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "sk",
      },
    });

    if (!response.ok) {
      rememberCityCoordinates(trimmed, null);
      return null;
    }

    const data = (await response.json()) as Array<{ lat?: string; lon?: string }>;
    const match = data[0];
    if (!match?.lat || !match?.lon) {
      rememberCityCoordinates(trimmed, null);
      return null;
    }

    const coordinates = {
      lat: Number(match.lat),
      lng: Number(match.lon),
    };

    rememberCityCoordinates(trimmed, coordinates);
    return coordinates;
  } catch {
    rememberCityCoordinates(trimmed, null);
    return null;
  }
}

export function resolveCityCoordinatesSync(city: string) {
  const cached = getCachedCityCoordinates(city);
  return cached === undefined ? null : cached;
}

function buildServiceLocationQuery(location: ServiceLocation) {
  const city = location.city.trim();
  return [location.address, location.zipCode, city, "Slovensko"]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

export function resolveServiceCoordinatesSync(
  location: ServiceLocation,
): CityCoordinates | null {
  const city = location.city.trim();
  if (!city) return null;

  const fullQuery = buildServiceLocationQuery(location);
  if (fullQuery) {
    const cached = coordinateCache.get(normalizeCityKey(fullQuery));
    if (cached) return cached;
  }

  return resolveCityCoordinatesSync(city);
}

export async function resolveServiceCoordinatesAsync(
  location: ServiceLocation,
): Promise<CityCoordinates | null> {
  return geocodeServiceLocation(location);
}

export function resolveCityCoordinates(city: string) {
  return resolveCityCoordinatesSync(city);
}

export async function resolveCityCoordinatesAsync(city: string) {
  const cached = getCachedCityCoordinates(city);
  if (cached !== undefined) return cached;
  return geocodeCity(city);
}

export async function warmCityCoordinates(cities: string[]) {
  const uniqueCities = Array.from(
    new Set(cities.map((city) => city.trim()).filter(Boolean)),
  );

  for (const city of uniqueCities) {
    if (getCachedCityCoordinates(city) !== undefined) continue;

    await new Promise<void>((resolve) => {
      enqueueGeocode(() => {
        void geocodeCity(city).finally(resolve);
      });
    });
  }
}

export function calculateDistanceKm(fromCity: string, toCity: string) {
  const from = resolveCityCoordinatesSync(fromCity);
  const to = resolveCityCoordinatesSync(toCity);
  if (!from || !to) return null;

  return Math.round(haversineKm(from, to) * 10) / 10;
}

export function getRequestDistanceFromService(
  request: { locationCity: string; distanceKm: number },
  serviceLocation: ServiceLocation,
) {
  const calculated = calculateDistanceKm(serviceLocation.city, request.locationCity);
  if (calculated !== null) return calculated;
  return request.distanceKm;
}

/** Broadcast dopyty podľa okruhu; priamy dopyt len pre cieľovú firmu. */
export function isRequestVisibleToCompany(
  request: Pick<Request, "locationCity" | "distanceKm" | "targetCompanyId">,
  companyId: string | null | undefined,
  serviceLocation: ServiceLocation,
  radiusKm: number,
) {
  if (request.targetCompanyId) {
    return Boolean(companyId && request.targetCompanyId === companyId);
  }

  return getRequestDistanceFromService(request, serviceLocation) <= radiusKm;
}

export function canCalculateDistanceForCity(city: string) {
  return resolveCityCoordinatesSync(city) !== null;
}

export function matchesVehicleCategoryFilter(
  request: Pick<Request, "vehicleCategory" | "fuelType" | "requestCategory">,
  filter: VehicleCategoryFilter,
) {
  if (request.requestCategory === "towing") return filter.towing;
  if (request.requestCategory === "tire") return filter.tire;

  if (isElectricVehicle(request) && !filter.electric) return false;
  if (request.vehicleCategory === "van") return filter.van;
  return filter.car;
}

export function formatServiceLocationLabel(location: ServiceLocation) {
  const parts = [
    location.address.trim(),
    location.zipCode.trim(),
    location.city.trim(),
  ].filter(Boolean);
  return parts.join(", ");
}

function normalizeServiceLocation(parsed: Partial<ServiceLocation>): ServiceLocation {
  const city =
    typeof parsed.city === "string" ? parsed.city : DEFAULT_SERVICE_LOCATION.city;
  const address =
    typeof parsed.address === "string"
      ? parsed.address
      : DEFAULT_SERVICE_LOCATION.address;
  let zipCode =
    typeof parsed.zipCode === "string"
      ? parsed.zipCode
      : DEFAULT_SERVICE_LOCATION.zipCode;

  if (!zipCode && address) {
    const zipMatch = address.match(/\b(\d{3}\s?\d{2})\b/);
    if (zipMatch) zipCode = zipMatch[1];
  }

  return {
    address: address.replace(/\b\d{3}\s?\d{2}\b/, "").replace(/,\s*$/, "").trim(),
    city,
    zipCode,
  };
}

export function loadServiceLocation(): ServiceLocation {
  if (typeof window === "undefined") return DEFAULT_SERVICE_LOCATION;

  try {
    const raw = window.localStorage.getItem(SERVICE_LOCATION_STORAGE_KEY);
    if (!raw) return DEFAULT_SERVICE_LOCATION;

    const parsed = JSON.parse(raw) as Partial<ServiceLocation>;
    return normalizeServiceLocation(parsed);
  } catch {
    return DEFAULT_SERVICE_LOCATION;
  }
}

export function saveServiceLocation(location: ServiceLocation) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    SERVICE_LOCATION_STORAGE_KEY,
    JSON.stringify({
      address: location.address.trim(),
      city: location.city.trim(),
      zipCode: location.zipCode.trim(),
    }),
  );
}

async function geocodeServiceLocation(location: ServiceLocation) {
  const city = location.city.trim();
  const fullQuery = [location.address, location.zipCode, city, "Slovensko"]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");

  if (location.address.trim() && fullQuery.length > 0) {
    const key = normalizeCityKey(fullQuery);
    if (coordinateCache.has(key)) {
      return coordinateCache.get(key) ?? null;
    }

    try {
      const params = new URLSearchParams({
        q: fullQuery,
        format: "json",
        limit: "1",
        countrycodes: "sk",
      });

      const response = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, {
        headers: {
          Accept: "application/json",
          "Accept-Language": "sk",
        },
      });

      if (response.ok) {
        const data = (await response.json()) as Array<{ lat?: string; lon?: string }>;
        const match = data[0];
        if (match?.lat && match?.lon) {
          const coordinates = {
            lat: Number(match.lat),
            lng: Number(match.lon),
          };
          coordinateCache.set(key, coordinates);
          rememberCityCoordinates(city, coordinates);
          return coordinates;
        }
      }
    } catch {
      // fallback na mesto
    }
  }

  return geocodeCity(city);
}

export async function prepareLocationFilter(
  serviceLocation: ServiceLocation,
  requestCities: string[],
) {
  const city = serviceLocation.city.trim();
  if (!city) {
    return { ok: false as const, reason: "empty" as const };
  }

  const serviceCoordinates = await geocodeServiceLocation(serviceLocation);
  if (!serviceCoordinates) {
    return { ok: false as const, reason: "unknown-city" as const };
  }

  await warmCityCoordinates([city, ...requestCities]);
  return { ok: true as const, serviceCoordinates };
}
