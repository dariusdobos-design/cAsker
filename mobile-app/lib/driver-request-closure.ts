export type DriverRequestCancelReason = "customer" | "no_service_accepted";

const EXPIRED_INQUIRY_CLOSURE_MESSAGE =
  "Počas dňa neodpovedal žiadny servis. Dopyt expiroval po polnoci.";

export function getDriverRequestClosureMessage(request: {
  status: string;
  cancelReason?: DriverRequestCancelReason | null;
  targetCompanyId?: string | null;
}) {
  if (request.status === "cancelled" && request.cancelReason === "no_service_accepted") {
    if (request.targetCompanyId) {
      return "Zrušené";
    }
    return "Dopyt nebol prijatý žiadným servisom v danom okolí.";
  }

  if (request.status === "cancelled") {
    return request.targetCompanyId ? "Zrušené" : "Dopyt bol zrušený.";
  }

  if (request.status === "expired") {
    return EXPIRED_INQUIRY_CLOSURE_MESSAGE;
  }

  return null;
}
