import {
  fetchVehicleByEcv,
  isValidEcv,
  normalizeEcv,
  VehicleLookupError,
} from "./stkonline-vehicle";
import type { Request, RequestCategory } from "./requests";
import { upsertRequest } from "./requests";

export type DriverVehicleSpecs = {
  vin?: string;
  engineVolume?: string;
  power?: string;
  fuelType?: string;
  year?: number;
  engine?: string;
  drive?: string;
  bodyType?: string;
  doors?: number;
  mileageKm?: number;
  transmission?: string;
};

export type DriverInquiryInput = {
  requestCategory: RequestCategory;
  licensePlate: string;
  vehicleName: string;
  vehicleTitle: string;
  locationCity: string;
  radiusKm: number;
  description: string;
  latitude?: number;
  longitude?: number;
  userName?: string;
  phone?: string;
  vehicleSpecs?: DriverVehicleSpecs;
};

function categoryServiceLabel(category: RequestCategory) {
  if (category === "tire") return "Dopyt — pneuservis";
  if (category === "towing") return "Odťah vozidla";
  return "Dopyt — autoservis";
}

function buildInquiryDescription(
  description: string,
  locationCity: string,
  radiusKm: number,
) {
  const trimmed = description.trim();
  const locationLine = `Hľadám servis v okolí ${Math.round(radiusKm)} km od ${locationCity.trim()}.`;

  return [trimmed, locationLine].filter(Boolean).join("\n\n");
}

function createInquiryId() {
  const suffix = Math.floor(Math.random() * 10_000)
    .toString()
    .padStart(4, "0");
  return `inq-${Date.now()}-${suffix}`;
}

async function enrichVehicleFromRegistry(licensePlate: string) {
  const ecv = normalizeEcv(licensePlate);
  if (!isValidEcv(ecv)) {
    return null;
  }

  try {
    return await fetchVehicleByEcv(ecv);
  } catch (error) {
    if (error instanceof VehicleLookupError) {
      return null;
    }
    throw error;
  }
}

export async function createDriverInquiry(input: DriverInquiryInput): Promise<Request> {
  const locationCity = input.locationCity.trim();
  if (!locationCity) {
    throw new Error("Zadajte mesto alebo použite „Moja poloha“.");
  }

  const registry = await enrichVehicleFromRegistry(input.licensePlate);
  const specs = input.vehicleSpecs;
  const vehicleName =
    registry?.znacka && registry?.model
      ? `${registry.znacka} ${registry.model}`.trim()
      : input.vehicleName.trim();
  const vehicleTitle = input.vehicleTitle.trim() || vehicleName;
  const resolvedYear = specs?.year ?? new Date().getFullYear();

  const createdAt = new Date().toISOString();
  const request: Request = {
    id: createInquiryId(),
    status: "inquiry",
    requestCategory: input.requestCategory,
    vehicleCategory: "car",
    vehicleName,
    vehicleTitle,
    service: categoryServiceLabel(input.requestCategory),
    licensePlate: normalizeEcv(input.licensePlate) || input.licensePlate.trim(),
    distanceKm: Math.max(0, Number(input.radiusKm) || 0),
    locationCity,
    vin: registry?.vin?.trim() || specs?.vin?.trim() || "—",
    engineVolume: specs?.engineVolume?.trim() || "—",
    power: specs?.power?.trim() || "—",
    fuelType: registry?.palivo?.trim() || specs?.fuelType?.trim() || "—",
    year: resolvedYear,
    engine: specs?.engine?.trim() || vehicleName,
    drive: specs?.drive?.trim() || "FWD",
    bodyType: specs?.bodyType?.trim() || "—",
    doors: specs?.doors ?? 5,
    mileageKm: specs?.mileageKm ?? 0,
    transmission: specs?.transmission?.trim() || "—",
    inquiryDescription: buildInquiryDescription(
      input.description,
      locationCity,
      input.radiusKm,
    ),
    userName: input.userName?.trim() || "Zákazník cAsker",
    phone: input.phone?.trim() || "+421 944 649 089",
    createdAt,
  };

  await upsertRequest(request, createdAt);
  return request;
}
