import { fetchAppointmentsForRequestIds } from "./appointments";
import { isInquiryCalendarDayBeforeToday } from "./inquiry-timezone";
import { getSupabaseServiceClient } from "./supabase-service";

const EXPIRE_RUN_INTERVAL_MS = 60_000;

let lastExpireRunAt = 0;

type InquiryCandidateRow = {
  id: string;
  created_at: string;
};

export type ExpireUnansweredInquiriesResult = {
  expiredCount: number;
  expiredIds: string[];
  skipped?: boolean;
};

export async function expireUnansweredInquiries(
  now = new Date(),
): Promise<ExpireUnansweredInquiriesResult> {
  const client = getSupabaseServiceClient();
  const { data, error } = await client
    .from("requests")
    .select("id, created_at")
    .eq("status", "inquiry");

  if (error) {
    if (error.code === "PGRST205" || error.code === "PGRST204") {
      return { expiredCount: 0, expiredIds: [] };
    }
    throw error;
  }

  const staleCandidates = ((data ?? []) as InquiryCandidateRow[]).filter((row) =>
    isInquiryCalendarDayBeforeToday(row.created_at, now),
  );

  if (staleCandidates.length === 0) {
    return { expiredCount: 0, expiredIds: [] };
  }

  const candidateIds = staleCandidates.map((row) => row.id);
  const appointments = await fetchAppointmentsForRequestIds(candidateIds);
  const respondedRequestIds = new Set(
    appointments
      .map((appointment) => appointment.request_id)
      .filter((requestId): requestId is string => typeof requestId === "string" && requestId.length > 0),
  );

  const idsToExpire = candidateIds.filter((id) => !respondedRequestIds.has(id));
  if (idsToExpire.length === 0) {
    return { expiredCount: 0, expiredIds: [] };
  }

  const updatedAt = now.toISOString();
  const { error: updateError } = await client
    .from("requests")
    .update({
      status: "expired",
      updated_at: updatedAt,
    })
    .in("id", idsToExpire)
    .eq("status", "inquiry");

  if (updateError) {
    if (updateError.code === "PGRST204" || updateError.message.includes("expired")) {
      throw new Error(
        "Chýba stav expired pre dopyty. Spustite migráciu supabase/add-expired-status.sql.",
      );
    }
    throw updateError;
  }

  return {
    expiredCount: idsToExpire.length,
    expiredIds: idsToExpire,
  };
}

export async function maybeExpireUnansweredInquiries(now = new Date()) {
  const timestamp = now.getTime();
  if (timestamp - lastExpireRunAt < EXPIRE_RUN_INTERVAL_MS) {
    return { expiredCount: 0, expiredIds: [], skipped: true as const };
  }

  lastExpireRunAt = timestamp;
  return expireUnansweredInquiries(now);
}

export function getExpiredInquiryClosureMessage() {
  return "Počas dňa neodpovedal žiadny servis. Dopyt expiroval po polnoci.";
}
