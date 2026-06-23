import type { DriverRequestSummary } from "@/lib/driver-requests-api";

export function getDriverHistoryDateIso(request: DriverRequestSummary) {
  return request.customerPickupConfirmedAt ?? request.createdAt;
}

export function toDriverHistoryDateKey(isoDate: string) {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate.slice(0, 10);
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDriverHistoryDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}

function getDriverHistoryServiceResponse(request: DriverRequestSummary) {
  const accepted = request.serviceResponses.find((response) => response.status === "accepted");
  if (accepted) {
    return accepted;
  }

  return request.serviceResponses.at(-1) ?? null;
}

export function getDriverHistoryServiceName(request: DriverRequestSummary) {
  const response = getDriverHistoryServiceResponse(request);
  if (response?.serviceName?.trim()) {
    return response.serviceName.trim();
  }

  return request.service?.trim() || null;
}

export function getDriverHistoryServiceAddress(request: DriverRequestSummary) {
  const response = getDriverHistoryServiceResponse(request);
  return response?.serviceAddress?.trim() || null;
}

export function groupDriverHistoryRequests(requests: DriverRequestSummary[]) {
  const groups = new Map<string, DriverRequestSummary[]>();

  for (const request of requests) {
    const dateKey = toDriverHistoryDateKey(getDriverHistoryDateIso(request));
    const bucket = groups.get(dateKey) ?? [];
    bucket.push(request);
    groups.set(dateKey, bucket);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([dateKey, items]) => ({
      dateKey,
      label: formatDriverHistoryDateLabel(dateKey),
      requests: [...items].sort(
        (left, right) =>
          new Date(getDriverHistoryDateIso(right)).getTime() -
          new Date(getDriverHistoryDateIso(left)).getTime(),
      ),
    }));
}
