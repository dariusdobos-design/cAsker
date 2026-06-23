import { createClient } from "@/lib/supabase/client";

export type ServiceProfilePost = {
  id: string;
  description: string;
  photos: string[];
  createdAt: string;
};

export type ServiceProfile = {
  displayName: string;
  about: string;
  services: string[];
  logoDataUrl: string | null;
  posts: ServiceProfilePost[];
};

type ServiceProfileRow = {
  display_name: string;
  about: string;
  services: string[] | null;
  logo_data_url: string | null;
  posts: unknown;
};

const SERVICE_PROFILE_SELECT = "display_name, about, services, logo_data_url, posts";

export function mapServiceProfilePosts(raw: unknown): ServiceProfilePost[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const post = item as Partial<ServiceProfilePost>;

      return {
        id: typeof post.id === "string" && post.id ? post.id : crypto.randomUUID(),
        description: typeof post.description === "string" ? post.description : "",
        photos: Array.isArray(post.photos)
          ? post.photos.filter((photo): photo is string => typeof photo === "string")
          : [],
        createdAt:
          typeof post.createdAt === "string" && post.createdAt
            ? post.createdAt
            : new Date().toISOString(),
      };
    })
    .filter((post): post is ServiceProfilePost => post !== null);
}

function mapServiceProfileRow(row: ServiceProfileRow): ServiceProfile {
  return {
    displayName: row.display_name ?? "",
    about: row.about ?? "",
    services: Array.isArray(row.services) ? row.services : [],
    logoDataUrl: row.logo_data_url || null,
    posts: mapServiceProfilePosts(row.posts),
  };
}

function missingTableError(error: { code?: string }) {
  if (error.code === "PGRST205" || error.code === "42P01") {
    return new Error(
      "Chýba tabuľka service_profiles. Spustite migráciu supabase/service-profiles.sql v Supabase SQL editore.",
    );
  }
  return null;
}

export async function fetchServiceProfile(): Promise<ServiceProfile | null> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) return null;

  const { data, error } = await supabase
    .from("service_profiles")
    .select(SERVICE_PROFILE_SELECT)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw missingTableError(error) ?? error;
  }

  if (!data) return null;
  return mapServiceProfileRow(data as ServiceProfileRow);
}

export async function saveServiceProfile(profile: ServiceProfile): Promise<ServiceProfile> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) {
    throw new Error("Nie ste prihlásený.");
  }

  const { data, error } = await supabase
    .from("service_profiles")
    .upsert(
      {
        user_id: user.id,
        display_name: profile.displayName.trim(),
        about: profile.about.trim(),
        services: profile.services.map((service) => service.trim()).filter(Boolean),
        logo_data_url: profile.logoDataUrl,
        posts: profile.posts.map((post) => ({
          id: post.id,
          description: post.description.trim(),
          photos: post.photos,
          createdAt: post.createdAt,
        })),
      },
      { onConflict: "user_id" },
    )
    .select(SERVICE_PROFILE_SELECT)
    .single();

  if (error) {
    throw missingTableError(error) ?? error;
  }

  return mapServiceProfileRow(data as ServiceProfileRow);
}
