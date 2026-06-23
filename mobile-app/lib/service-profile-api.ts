export type ServiceProfilePost = {
  id: string;
  description: string;
  photos: string[];
  createdAt: string;
};

export type PublicServiceProfile = {
  companyId: string;
  companyName: string;
  displayName: string;
  address: string;
  city: string;
  zipCode: string;
  about: string;
  services: string[];
  logoDataUrl: string | null;
  posts: ServiceProfilePost[];
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

export async function fetchPublicServiceProfile(
  companyId: string,
): Promise<PublicServiceProfile> {
  let response: Response;

  try {
    response = await fetch(
      `${getApiBaseUrl()}/api/services/profile?companyId=${encodeURIComponent(companyId)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      },
    );
  } catch {
    throw new Error("Nepodarilo sa spojiť so serverom.");
  }

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; profile?: PublicServiceProfile }
    | null;

  if (!response.ok || !payload?.profile) {
    throw new Error(payload?.error ?? "Profil servisu sa nepodarilo načítať.");
  }

  return payload.profile;
}
