import {
  fetchAppointmentsForRequestIds,
  formatAppointmentDisplayDate,
  formatAppointmentDisplayTime,
  formatAppointmentServiceAddress,
  type Appointment,
} from "./appointments";
import { resolveServiceCoordinatesServer } from "./geocode-server";
import { countUnreadRequestMessagesForCustomer } from "./request-messages";
import { fetchRequestsByIds, type Request } from "./requests";
import {
  DEFAULT_SERVICE_LOCATION,
  resolveServiceCoordinatesSync,
  type CityCoordinates,
  type ServiceLocation,
} from "./service-location";
import { SERVICE_DISPLAY_NAME } from "./service-config";

export type CustomerServiceResponse = {
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

export type CustomerRequestWithResponses = Request & {
  serviceResponses: CustomerServiceResponse[];
  unreadChatCount: number;
};

const CUSTOMER_VISIBLE_REQUEST_STATUSES = new Set<Request["status"]>([
  "inquiry",
  "waiting",
  "done",
]);

function appointmentServiceLocation(appointment: Appointment): ServiceLocation {
  return {
    address: appointment.serviceAddress?.trim() ?? "",
    city: appointment.serviceCity?.trim() ?? "",
    zipCode: appointment.serviceZip?.trim() ?? "",
  };
}

function serviceLocationKey(location: ServiceLocation) {
  return [location.address, location.zipCode, location.city]
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .join("|");
}

async function resolveServiceLocationCoordinates(
  location: ServiceLocation,
  cache: Map<string, CityCoordinates | null>,
) {
  const key = serviceLocationKey(location);
  if (cache.has(key)) {
    return cache.get(key) ?? null;
  }

  if (!location.city) {
    cache.set(key, null);
    return null;
  }

  const coordinates =
    resolveServiceCoordinatesSync(location) ??
    (await resolveServiceCoordinatesServer(location));

  cache.set(key, coordinates);
  return coordinates;
}

function mapAppointmentToServiceResponse(
  appointment: Appointment,
  coordinates: CityCoordinates | null,
): CustomerServiceResponse {
  const address = formatAppointmentServiceAddress(appointment);
  const dateLabel = formatAppointmentDisplayDate(appointment.appointment_date);
  const timeLabel = formatAppointmentDisplayTime(appointment.appointment_time);

  return {
    id: appointment.id,
    requestId: appointment.request_id ?? "",
    serviceName: appointment.companyName?.trim() || SERVICE_DISPLAY_NAME,
    serviceAddress:
      address ||
      `${DEFAULT_SERVICE_LOCATION.address}, ${DEFAULT_SERVICE_LOCATION.city}`.replace(
        /^,\s*|,\s*$/g,
        "",
      ),
    serviceLatitude: coordinates?.lat ?? null,
    serviceLongitude: coordinates?.lng ?? null,
    appointmentDate: appointment.appointment_date,
    appointmentTime: appointment.appointment_time,
    scheduleLabel: `${dateLabel} · ${timeLabel}`,
    message: appointment.message?.trim() || null,
    status: appointment.status === "accepted" ? "accepted" : "pending",
    createdAt: appointment.created_at ?? null,
  };
}

export async function fetchCustomerRequestsWithResponses(
  requestIds: string[],
): Promise<CustomerRequestWithResponses[]> {
  const requests = (await fetchRequestsByIds(requestIds)).filter((request) =>
    CUSTOMER_VISIBLE_REQUEST_STATUSES.has(request.status),
  );
  const visibleRequestIds = requests.map((request) => request.id);
  const appointments = await fetchAppointmentsForRequestIds(visibleRequestIds);

  const responsesByRequest = new Map<string, CustomerServiceResponse[]>();
  const coordinateCache = new Map<string, CityCoordinates | null>();

  for (const appointment of appointments) {
    if (!appointment.request_id) continue;
    if (appointment.status !== "pending" && appointment.status !== "accepted") continue;

    const coordinates = await resolveServiceLocationCoordinates(
      appointmentServiceLocation(appointment),
      coordinateCache,
    );

    const current = responsesByRequest.get(appointment.request_id) ?? [];
    current.push(mapAppointmentToServiceResponse(appointment, coordinates));
    responsesByRequest.set(appointment.request_id, current);
  }

  for (const [requestId, responses] of responsesByRequest) {
    responses.sort((left, right) => {
      const leftKey = left.createdAt ?? "";
      const rightKey = right.createdAt ?? "";
      return leftKey.localeCompare(rightKey);
    });
    responsesByRequest.set(requestId, responses);
  }

  const unreadChatCounts = await countUnreadRequestMessagesForCustomer(visibleRequestIds);

  return requests.map((request) => ({
    ...request,
    serviceResponses: responsesByRequest.get(request.id) ?? [],
    unreadChatCount: unreadChatCounts.get(request.id) ?? 0,
  }));
}
