import { NextResponse } from "next/server";

import { mapServiceProfilePosts } from "@/lib/service-profile";
import { supabase } from "@/lib/supabase";

type CompanyRow = {
  id: string;
  user_id: string;
  company_name: string;
  operation_street: string;
  operation_city: string;
  operation_zip: string;
  billing_street: string;
  billing_city: string;
  billing_zip: string;
};

type ServiceProfileRow = {
  display_name: string;
  about: string;
  services: string[] | null;
  logo_data_url: string | null;
  posts: unknown;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId")?.trim();

  if (!companyId) {
    return NextResponse.json({ error: "Chýba parameter companyId." }, { status: 400 });
  }

  try {
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select(
        "id, user_id, company_name, operation_street, operation_city, operation_zip, billing_street, billing_city, billing_zip",
      )
      .eq("id", companyId)
      .maybeSingle();

    if (companyError) throw companyError;

    if (!company) {
      return NextResponse.json({ error: "Servis sa nenašiel." }, { status: 404 });
    }

    const companyRow = company as CompanyRow;

    let profileRow: ServiceProfileRow | null = null;
    const { data: profileData, error: profileError } = await supabase
      .from("service_profiles")
      .select("display_name, about, services, logo_data_url, posts")
      .eq("user_id", companyRow.user_id)
      .maybeSingle();

    if (profileError) {
      // Tabuľka profilov ešte nemusí existovať — vrátime aspoň údaje o firme.
      if (profileError.code !== "PGRST205" && profileError.code !== "42P01") {
        throw profileError;
      }
    } else {
      profileRow = profileData as ServiceProfileRow | null;
    }

    const city = companyRow.operation_city.trim() || companyRow.billing_city.trim();
    const address = companyRow.operation_street.trim() || companyRow.billing_street.trim();
    const zipCode = companyRow.operation_zip.trim() || companyRow.billing_zip.trim();

    return NextResponse.json({
      profile: {
        companyId: companyRow.id,
        companyName: companyRow.company_name.trim(),
        displayName: profileRow?.display_name?.trim() || companyRow.company_name.trim(),
        address,
        city,
        zipCode,
        about: profileRow?.about ?? "",
        services: Array.isArray(profileRow?.services) ? profileRow.services : [],
        logoDataUrl: profileRow?.logo_data_url || null,
        posts: mapServiceProfilePosts(profileRow?.posts),
      },
    });
  } catch (error) {
    console.error("[api/services/profile]", error);
    return NextResponse.json(
      { error: "Profil servisu sa nepodarilo načítať." },
      { status: 500 },
    );
  }
}
