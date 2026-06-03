import { fetchCompanyByIco, normalizeIco } from "@/lib/company-registry";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ ico: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { ico } = await context.params;

  if (!normalizeIco(ico)) {
    return NextResponse.json({ error: "Chýba IČO." }, { status: 400 });
  }

  try {
    const company = await fetchCompanyByIco(ico);
    return NextResponse.json(company);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nepodarilo sa načítať údaje firmy.";

    return NextResponse.json({ error: message }, { status: 404 });
  }
}
