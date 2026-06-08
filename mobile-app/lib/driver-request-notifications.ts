import {
  isActiveDriverRequest,
  type DriverRequestSummary,
} from "@/lib/driver-requests-api";

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
