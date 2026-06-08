import { resolveServiceCoordinatesServer } from "./geocode-server";
import { supabase } from "./supabase";
import {
  resolveServiceCoordinatesSync,
  type CityCoordinates,
  type ServiceLocation,
} from "./service-location";

export type PublicMapService = {
  id: string;
  companyName: string;
  address: string;
  city: string;
  zipCode: string;
  latitude: number;
  longitude: number;
};

type CompanyMapRow = {
  id: string;
  company_name: string;
  operation_street: string;
  operation_city: string;
  operation_zip: string;
  billing_street: string;
  billing_city: string;
  billing_zip: string;
};

function companyRowToServiceLocation(row: CompanyMapRow): ServiceLocation {
  const city = row.operation_city.trim() || row.billing_city.trim();
  const address = row.operation_street.trim() || row.billing_street.trim();
  const zipCode = row.operation_zip.trim() || row.billing_zip.trim();

  return { address, city, zipCode };
}

function spreadDuplicateCoordinates(
  services: Array<PublicMapService & { coordinates: CityCoordinates }>,
) {
  const groups = new Map<string, typeof services>();

  for (const service of services) {
    const key = `${service.coordinates.lat.toFixed(4)}:${service.coordinates.lng.toFixed(4)}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(service);
    groups.set(key, bucket);
  }

  const spread: PublicMapService[] = [];

  for (const bucket of groups.values()) {
    bucket.forEach((service, index) => {
      const angle = (index / Math.max(bucket.length, 1)) * Math.PI * 2;
      const radius = index === 0 ? 0 : 0.004 + index * 0.0015;

      spread.push({
        id: service.id,
        companyName: service.companyName,
        address: service.address,
        city: service.city,
        zipCode: service.zipCode,
        latitude: service.coordinates.lat + Math.sin(angle) * radius,
        longitude: service.coordinates.lng + Math.cos(angle) * radius,
      });
    });
  }

  return spread.sort((left, right) =>
    left.companyName.localeCompare(right.companyName, "sk"),
  );
}

export async function fetchPublicMapServices(): Promise<PublicMapService[]> {
  const { data, error } = await supabase
    .from("companies")
    .select(
      "id, company_name, operation_street, operation_city, operation_zip, billing_street, billing_city, billing_zip",
    );

  if (error) {
    if (error.code === "PGRST205") {
      return [];
    }
    throw error;
  }

  const candidates: Array<{
    row: CompanyMapRow;
    companyName: string;
    location: ServiceLocation;
  }> = [];

  for (const row of (data ?? []) as CompanyMapRow[]) {
    const companyName = row.company_name.trim();
    if (!companyName) continue;

    const location = companyRowToServiceLocation(row);
    if (!location.city) continue;

    candidates.push({ row, companyName, location });
  }

  const resolved: Array<PublicMapService & { coordinates: CityCoordinates }> = [];

  for (const candidate of candidates) {
    const coordinates =
      resolveServiceCoordinatesSync(candidate.location) ??
      (await resolveServiceCoordinatesServer(candidate.location));

    if (!coordinates) continue;

    resolved.push({
      id: candidate.row.id,
      companyName: candidate.companyName,
      address: candidate.location.address,
      city: candidate.location.city,
      zipCode: candidate.location.zipCode,
      latitude: coordinates.lat,
      longitude: coordinates.lng,
      coordinates,
    });
  }

  return spreadDuplicateCoordinates(resolved);
}
