import type { RequestCategoryId } from "@/lib/request-category";

export type SubmitDriverVehicleSpecs = {
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

export type SubmitDriverInquiryInput = {
  requestCategory: RequestCategoryId;
  licensePlate: string;
  vehicleName: string;
  vehicleTitle: string;
  locationCity: string;
  radiusKm: number;
  description: string;
  photos?: string[];
  latitude?: number;
  longitude?: number;
  userName?: string;
  phone?: string;
  vehicleSpecs?: SubmitDriverVehicleSpecs;
  targetCompanyId?: string;
  targetCompanyName?: string;
};

function getApiBaseUrl() {
  const base = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, "");
  if (!base) {
    throw new Error(
      "Chýba EXPO_PUBLIC_API_URL. V mobile-app/.env nastavte URL Next.js servera (napr. http://192.168.1.10:3000).",
    );
  }
  return base;
}

export async function submitDriverInquiry(input: SubmitDriverInquiryInput) {
  const response = await fetch(`${getApiBaseUrl()}/api/requests/inquiry`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; request?: { id: string } }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Dopyt sa nepodarilo odoslať.");
  }

  if (!payload?.request?.id) {
    throw new Error("Server nevrátil ID vytvoreného dopytu.");
  }

  return payload.request;
}
