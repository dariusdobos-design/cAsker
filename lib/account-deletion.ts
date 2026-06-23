import { randomBytes } from "node:crypto";

import { getAppBaseUrl } from "@/lib/app-url";
import { sendEmail } from "@/lib/send-email";
import { getSupabaseServiceClient } from "@/lib/supabase-service";

const DELETION_GRACE_DAYS = 3;

type DriverAccountDeletionRow = {
  id: string;
  email: string;
  user_name: string;
  phone: string | null;
  cancel_token: string;
  status: "pending" | "cancelled" | "completed";
  created_at: string;
  expires_at: string;
  cancelled_at: string | null;
};

function createCancelToken() {
  return randomBytes(24).toString("hex");
}

function buildKeepAccountUrl(token: string) {
  return `${getAppBaseUrl()}/account/keep?token=${encodeURIComponent(token)}`;
}

function buildDeletionEmailHtml(userName: string, keepAccountUrl: string) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px;margin:0 auto;padding:24px;">
      <h1 style="color:#0b194f;font-size:22px;margin:0 0 16px;">cAsker</h1>
      <p>Dobrý deň${userName ? ` ${userName}` : ""},</p>
      <p>
        prijali sme vašu požiadavku na odstránenie účtu. Požiadavka bude spracovaná
        do <strong>${DELETION_GRACE_DAYS} dní</strong>.
      </p>
      <p>
        Ak si to rozmyslíte, môžete vymazanie účtu odvolať do ${DELETION_GRACE_DAYS} dní
        kliknutím na tlačidlo nižšie.
      </p>
      <p style="margin:28px 0;">
        <a
          href="${keepAccountUrl}"
          style="display:inline-block;background:#0b194f;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:12px;"
        >
          Ponechať účet
        </a>
      </p>
      <p style="font-size:13px;color:#64748b;">
        Ak ste o odstránenie účtu nežiadali, kliknite na tlačidlo „Ponechať účet“
        alebo kontaktujte podporu cAsker.
      </p>
    </div>
  `;
}

export async function requestDriverAccountDeletion(input: {
  email: string;
  userName: string;
  phone?: string;
}) {
  const email = input.email.trim().toLowerCase();
  const userName = input.userName.trim();
  const phone = input.phone?.trim() || null;

  if (!email) {
    throw new Error("Chýba e-mail účtu.");
  }

  if (!userName) {
    throw new Error("Chýba meno účtu.");
  }

  const supabase = getSupabaseServiceClient();
  const cancelToken = createCancelToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + DELETION_GRACE_DAYS);

  await supabase
    .from("driver_account_deletion_requests")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("email", email)
    .eq("status", "pending");

  const { data, error } = await supabase
    .from("driver_account_deletion_requests")
    .insert({
      email,
      user_name: userName,
      phone,
      cancel_token: cancelToken,
      status: "pending",
      expires_at: expiresAt.toISOString(),
    })
    .select("id, cancel_token")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Požiadavku sa nepodarilo uložiť.");
  }

  const keepAccountUrl = buildKeepAccountUrl(data.cancel_token);

  await sendEmail({
    to: email,
    subject: "cAsker – požiadavka na odstránenie účtu",
    html: buildDeletionEmailHtml(userName, keepAccountUrl),
  });

  return {
    requestId: data.id as string,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function cancelDriverAccountDeletion(token: string) {
  const trimmedToken = token.trim();
  if (!trimmedToken) {
    throw new Error("Chýba token požiadavky.");
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("driver_account_deletion_requests")
    .select("*")
    .eq("cancel_token", trimmedToken)
    .maybeSingle<DriverAccountDeletionRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Požiadavka sa nenašla alebo už nie je platná.");
  }

  if (data.status === "cancelled") {
    return {
      alreadyCancelled: true,
      email: data.email,
      userName: data.user_name,
    };
  }

  if (data.status === "completed") {
    throw new Error("Účet už bol odstránený.");
  }

  if (new Date(data.expires_at).getTime() < Date.now()) {
    throw new Error("Lehota na odvolanie požiadavky už vypršala.");
  }

  const { error: updateError } = await supabase
    .from("driver_account_deletion_requests")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", data.id)
    .eq("status", "pending");

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    alreadyCancelled: false,
    email: data.email,
    userName: data.user_name,
  };
}
