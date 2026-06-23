import { NextResponse } from "next/server";

import { requestDriverAccountDeletion } from "@/lib/account-deletion";

export async function POST(request: Request) {
  let body: { email?: string; userName?: string; phone?: string };

  try {
    body = (await request.json()) as { email?: string; userName?: string; phone?: string };
  } catch {
    return NextResponse.json({ error: "Neplatné JSON telo požiadavky." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email : "";
  const userName = typeof body.userName === "string" ? body.userName : "";
  const phone = typeof body.phone === "string" ? body.phone : undefined;

  try {
    const created = await requestDriverAccountDeletion({
      email,
      userName,
      phone,
    });

    return NextResponse.json({ ok: true, request: created }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Požiadavku sa nepodarilo spracovať.";
    console.error("[api/account/delete-request]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
