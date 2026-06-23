export type MapServiceMarker = {
  id: string;
  companyName: string;
  address: string;
  city: string;
  zipCode: string;
  latitude: number;
  longitude: number;
};

function getApiBaseUrl() {
  const base = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, "");
  if (!base) {
    throw new Error(
      "Chýba EXPO_PUBLIC_API_URL. V mobile-app/.env nastavte URL Next.js servera.",
    );
  }
  return base;
}

export async function fetchMapServices(): Promise<MapServiceMarker[]> {
  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}/api/services/map`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
  } catch {
    throw new Error(
      "Nepodarilo sa spojiť so serverom. Skontrolujte EXPO_PUBLIC_API_URL a či beží Next.js (npm run dev).",
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; services?: MapServiceMarker[] }
    | null;

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        "API server nenašiel endpoint. Reštartujte Next.js (npm run dev) v priečinku cAsker.",
      );
    }
    throw new Error(payload?.error ?? "Servisy na mape sa nepodarilo načítať.");
  }

  return payload?.services ?? [];
}
