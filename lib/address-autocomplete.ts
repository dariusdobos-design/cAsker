const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";

export type AddressSuggestion = {
  id: string;
  label: string;
  address: string;
  city: string;
  zipCode: string;
  lat: number;
  lng: number;
};

type NominatimAddress = {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  postcode?: string;
};

type NominatimResult = {
  place_id?: number;
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: NominatimAddress;
};

function buildStreetLine(address: NominatimAddress) {
  const road = address.road ?? address.pedestrian ?? "";
  const houseNumber = address.house_number ?? "";
  return [road, houseNumber].filter(Boolean).join(" ").trim();
}

function extractCity(address: NominatimAddress) {
  return (
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    ""
  ).trim();
}

function formatZipCode(value: string) {
  const digits = value.replace(/\s/g, "");
  if (digits.length === 5) {
    return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  }
  return value.trim();
}

function formatSuggestionLabel(
  street: string,
  city: string,
  zipCode: string,
  fallback: string,
) {
  const parts = [street, city, zipCode].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : fallback;
}

function mapNominatimResult(result: NominatimResult): AddressSuggestion | null {
  if (!result.place_id || !result.lat || !result.lon) return null;

  const addressParts = result.address ?? {};
  const street = buildStreetLine(addressParts);
  const city = extractCity(addressParts);
  const zipCode = formatZipCode(addressParts.postcode ?? "");
  const fallback = result.display_name?.split(",").slice(0, 3).join(", ") ?? "";

  return {
    id: String(result.place_id),
    label: formatSuggestionLabel(street, city, zipCode, fallback),
    address: street,
    city,
    zipCode,
    lat: Number(result.lat),
    lng: Number(result.lon),
  };
}

export async function searchAddressSuggestions(
  query: string,
  options?: { signal?: AbortSignal },
): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const params = new URLSearchParams({
    q: `${trimmed}, Slovensko`,
    format: "json",
    addressdetails: "1",
    limit: "8",
    countrycodes: "sk",
  });

  const response = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "sk",
    },
    signal: options?.signal,
  });

  if (!response.ok) return [];

  const data = (await response.json()) as NominatimResult[];
  const suggestions: AddressSuggestion[] = [];

  for (const result of data) {
    const mapped = mapNominatimResult(result);
    if (!mapped) continue;
    if (!mapped.city && !mapped.address) continue;
    suggestions.push(mapped);
  }

  return suggestions;
}

export function buildServiceLocationQuery(location: {
  address: string;
  city: string;
  zipCode: string;
}) {
  return [location.address, location.zipCode, location.city, "Slovensko"]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}
