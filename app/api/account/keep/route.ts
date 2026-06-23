import { NextResponse } from "next/server";

import { cancelDriverAccountDeletion } from "@/lib/account-deletion";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";

  if (!token) {
    return NextResponse.json({ error: "Chýba token požiadavky." }, { status: 400 });
  }

  try {
    const result = await cancelDriverAccountDeletion(token);
    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Požiadavku sa nepodarilo zrušiť.";
    console.error("[api/account/keep]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
