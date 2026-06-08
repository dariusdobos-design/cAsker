import type { CityCoordinates, ServiceLocation } from "./service-location";

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "cAsker/1.0 (service-map)";

const coordinateCache = new Map<string, CityCoordinates | null>();

function buildServiceLocationQuery(location: ServiceLocation) {
  const city = location.city.trim();
  return [location.address, location.zipCode, city, "Slovensko"]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

async function geocodeQuery(query: string): Promise<CityCoordinates | null> {
  const cacheKey = query.trim().toLowerCase();
  if (!cacheKey) return null;

  if (coordinateCache.has(cacheKey)) {
    return coordinateCache.get(cacheKey) ?? null;
  }

  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      limit: "1",
      countrycodes: "sk",
    });

    const response = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "sk",
        "User-Agent": USER_AGENT,
      },
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      coordinateCache.set(cacheKey, null);
      return null;
    }

    const data = (await response.json()) as Array<{ lat?: string; lon?: string }>;
    const match = data[0];

    if (!match?.lat || !match?.lon) {
      coordinateCache.set(cacheKey, null);
      return null;
    }

    const coordinates = {
      lat: Number(match.lat),
      lng: Number(match.lon),
    };

    coordinateCache.set(cacheKey, coordinates);
    return coordinates;
  } catch {
    coordinateCache.set(cacheKey, null);
    return null;
  }
}

export async function resolveServiceCoordinatesServer(
  location: ServiceLocation,
): Promise<CityCoordinates | null> {
  const city = location.city.trim();
  if (!city) return null;

  const fullQuery = buildServiceLocationQuery(location);
  if (fullQuery) {
    const fullMatch = await geocodeQuery(fullQuery);
    if (fullMatch) return fullMatch;
  }

  return geocodeQuery(`${city}, Slovensko`);
}

export async function resolveServiceCoordinatesBatch(
  locations: ServiceLocation[],
): Promise<Array<CityCoordinates | null>> {
  const results: Array<CityCoordinates | null> = [];

  for (const location of locations) {
    results.push(await resolveServiceCoordinatesServer(location));
    if (locations.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }
  }

  return results;
}
