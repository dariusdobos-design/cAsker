import type { RequestCategoryId } from "@/lib/request-category";

export type DriverRequestStatus =
  | "inquiry"
  | "waiting"
  | "done"
  | "completed"
  | "cancelled"
  | "expired";

export type DriverServiceResponse = {
  id: string;
  requestId: string;
  serviceName: string;
  serviceAddress: string;
  serviceLatitude: number | null;
  serviceLongitude: number | null;
  appointmentDate: string;
  appointmentTime: string;
  scheduleLabel: string;
  message: string | null;
  status: "pending" | "accepted";
  createdAt: string | null;
};

export type DriverRequestSummary = {
  id: string;
  status: DriverRequestStatus;
  requestCategory: RequestCategoryId;
  vehicleName: string;
  vehicleTitle: string;
  licensePlate: string;
  locationCity: string;
  service: string;
  year: number;
  inquiryDescription: string;
  createdAt: string;
  serviceResponses: DriverServiceResponse[];
  unreadChatCount: number;
};

export type DriverRequestMessage = {
  id: string;
  requestId: string;
  senderRole: "service" | "customer";
  body: string;
  createdAt: string;
  readAt: string | null;
};

function getApiBaseUrl() {
  const base = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, "");
  if (!base) {
    throw new Error(
      "Chýba EXPO_PUBLIC_API_URL. V mobile-app/.env nastavte URL Next.js servera.",
    );
  }
  return base;
}

export function isActiveDriverRequest(status: DriverRequestStatus) {
  return status === "inquiry" || status === "waiting" || status === "done";
}

export async function fetchMyDriverRequests(ids: string[]) {
  const response = await fetch(`${getApiBaseUrl()}/api/requests/mine`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ids }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; requests?: DriverRequestSummary[] }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Dopyty sa nepodarilo načítať.");
  }

  return (payload?.requests ?? []).map((request) => ({
    ...request,
    serviceResponses: request.serviceResponses ?? [],
    unreadChatCount: request.unreadChatCount ?? 0,
  }));
}

export async function fetchDriverRequestMessages(requestId: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/requests/messages/list`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; messages?: DriverRequestMessage[] }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Správy sa nepodarilo načítať.");
  }

  return payload?.messages ?? [];
}

export async function sendDriverRequestMessage(requestId: string, text: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/requests/messages/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId, text, senderRole: "customer" }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; message?: DriverRequestMessage }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Správu sa nepodarilo odoslať.");
  }

  return payload?.message ?? null;
}

export async function markDriverRequestMessagesRead(requestId: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/requests/messages/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId, reader: "customer" }),
  });

  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Stav prečítania sa nepodarilo uložiť.");
  }
}

export async function cancelDriverRequest(requestId: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/requests/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: requestId }),
  });

  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Dopyt sa nepodarilo zrušiť.");
  }
}

export async function acceptDriverServiceResponse(appointmentId: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/requests/appointments/accept`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ appointmentId }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; requestId?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Termín sa nepodarilo prijať.");
  }

  return payload?.requestId ?? null;
}

export async function rejectDriverServiceResponse(appointmentId: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/requests/appointments/reject`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ appointmentId }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; requestId?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Ponuku sa nepodarilo odmietnuť.");
  }

  return payload?.requestId ?? null;
}

export async function requestDriverReschedule(requestId: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/requests/appointments/reschedule-request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requestId }),
  });

  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Žiadosť o zmenu termínu sa nepodarilo odoslať.");
  }
}
