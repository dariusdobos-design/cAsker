import type { Request, RequestCategory } from "./requests";
import { resolveCityCoordinatesSync, type CityCoordinates } from "./service-location";

function normalizeMapText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const LOCATION_SHARE_KEYWORDS = [
  "zdielam polohu",
  "zdielam lokaciu",
  "poloha na mape",
  "zobrazit na mape",
  "presna poloha",
  "gps poloha",
  "moja poloha",
  "zdielanie polohy",
  "share location",
  "lokalizacia na mape",
];

export type MapEligibleRequest = Pick<
  Request,
  | "id"
  | "service"
  | "inquiryDescription"
  | "locationCity"
  | "vehicleName"
  | "vehicleTitle"
  | "licensePlate"
  | "requestCategory"
> & {
  isEmergency?: boolean | null;
  shareLocationOnMap?: boolean | null;
  mapLatitude?: number | null;
  mapLongitude?: number | null;
};

/** Červený bod na mape = len kategória odťah (alebo explicitný príznak isEmergency). */
export function isEmergencyMapRequest(
  request: Pick<
    MapEligibleRequest,
    "isEmergency" | "requestCategory"
  >,
): boolean {
  if (request.requestCategory === "towing") return true;
  return request.isEmergency === true;
}

export function hasSharedMapLocation(
  request: Pick<
    MapEligibleRequest,
    "service" | "inquiryDescription" | "shareLocationOnMap"
  >,
): boolean {
  if (request.shareLocationOnMap) return true;

  const haystack = normalizeMapText(`${request.service} ${request.inquiryDescription}`);
  return LOCATION_SHARE_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

/** Mapa: zatiaľ len odťah (towing) alebo explicitný emergency príznak. */
export function shouldShowRequestOnMap(request: MapEligibleRequest): boolean {
  if (request.requestCategory === "towing") return true;
  return request.isEmergency === true;
}

export function getRequestMapPosition(
  request: Pick<
    MapEligibleRequest,
    "locationCity" | "mapLatitude" | "mapLongitude"
  >,
): CityCoordinates | null {
  if (
    typeof request.mapLatitude === "number" &&
    typeof request.mapLongitude === "number" &&
    Number.isFinite(request.mapLatitude) &&
    Number.isFinite(request.mapLongitude)
  ) {
    return { lat: request.mapLatitude, lng: request.mapLongitude };
  }

  return resolveCityCoordinatesSync(request.locationCity);
}

export type RequestMapPoint = {
  id: string;
  position: CityCoordinates;
  title: string;
  isEmergency: boolean;
  requestCategory: RequestCategory;
  vehicleName: string;
  vehicleTitle: string;
  licensePlate: string;
  locationCity: string;
  service: string;
  inquiryDescription: string;
};

export function buildRequestMapPoints(requests: MapEligibleRequest[]): RequestMapPoint[] {
  const points: RequestMapPoint[] = [];

  for (const request of requests) {
    if (!shouldShowRequestOnMap(request)) continue;

    const position = getRequestMapPosition(request);
    if (!position) continue;

    points.push({
      id: request.id,
      position,
      title: `${request.vehicleName} · EČ ${request.licensePlate}`,
      isEmergency: isEmergencyMapRequest(request),
      requestCategory: request.requestCategory,
      vehicleName: request.vehicleName,
      vehicleTitle: request.vehicleTitle,
      licensePlate: request.licensePlate,
      locationCity: request.locationCity,
      service: request.service,
      inquiryDescription: request.inquiryDescription,
    });
  }

  return points;
}
