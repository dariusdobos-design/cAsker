import {
  isActiveDriverRequest,
  isHistoryDriverRequest,
  isReceivedDriverRequest,
  type DriverRequestSummary,
} from "@/lib/driver-requests-api";

/** Dopyt presunutý do histórie bez akcie zákazníka (servisy odmietli alebo dopyt expiroval). */
export function isHistoryClosureNotificationRequest(
  request: Pick<DriverRequestSummary, "status" | "cancelReason" | "targetCompanyId">,
) {
  if (request.status === "expired") {
    return true;
  }

  if (request.status === "cancelled" && request.cancelReason === "no_service_accepted") {
    return !request.targetCompanyId;
  }

  return false;
}

/** Neprečítané systémové ukončenia dopytov v záložke História. */
export function countHistoryTabNotifications(
  requests: DriverRequestSummary[],
  seenRequestIds: ReadonlySet<string>,
) {
  return requests.filter(
    (request) =>
      isHistoryDriverRequest(request) &&
      isHistoryClosureNotificationRequest(request) &&
      !seenRequestIds.has(request.id),
  ).length;
}

export function isUnseenHistoryClosureNotification(
  request: DriverRequestSummary,
  seenRequestIds: ReadonlySet<string>,
) {
  return (
    isHistoryDriverRequest(request) &&
    isHistoryClosureNotificationRequest(request) &&
    !seenRequestIds.has(request.id)
  );
}

/** Čakajúce ponuky termínu od servisu (pending), ktoré zákazník ešte neprijal ani neodmietol. */
export function countPendingServiceResponses(requests: DriverRequestSummary[]) {
  return requests.reduce((total, request) => {
    if (!isActiveDriverRequest(request.status)) {
      return total;
    }
    return (
      total + request.serviceResponses.filter((response) => response.status === "pending").length
    );
  }, 0);
}

/** Neprečítané chat správy od servisu v aktívnych dopytoch. */
export function countUnreadChatMessages(requests: DriverRequestSummary[]) {
  return requests.reduce((total, request) => {
    if (!isActiveDriverRequest(request.status)) {
      return total;
    }
    return total + (request.unreadChatCount ?? 0);
  }, 0);
}

/** Hotové vozidlá čakajúce na potvrdenie prevzatia v záložke Hotové. */
export function countReceivedTabNotifications(requests: DriverRequestSummary[]) {
  return requests.filter((request) => isReceivedDriverRequest(request)).length;
}
