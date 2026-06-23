import { fetchAppointmentsForRequestIds, rejectCustomerAppointment } from "./appointments";
import { getExpiredInquiryClosureMessage } from "./expire-unanswered-inquiries";
import { fetchPublicMapServices } from "./public-services";
import { fetchRequestById, type Request } from "./requests";
import { isRequestVisibleToCompany, type ServiceLocation } from "./service-location";
import { supabase } from "./supabase";

export type RequestCancelReason = "customer" | "no_service_accepted";

function mapServiceToLocation(service: {
  address: string;
  city: string;
  zipCode: string;
}): ServiceLocation {
  return {
    address: service.address,
    city: service.city,
    zipCode: service.zipCode,
  };
}

export async function fetchDeclinedRequestIdsForCompany(companyId: string) {
  const trimmed = companyId.trim();
  if (!trimmed) {
    return [];
  }

  const { data, error } = await supabase
    .from("request_service_declines")
    .select("request_id")
    .eq("company_id", trimmed);

  if (error) {
    if (error.code === "PGRST205" || error.code === "PGRST204") {
      return [];
    }
    throw error;
  }

  return (data ?? [])
    .map((row) => row.request_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

export async function fetchDeclinedCompanyIdsForRequest(requestId: string) {
  const { data, error } = await supabase
    .from("request_service_declines")
    .select("company_id")
    .eq("request_id", requestId);

  if (error) {
    if (error.code === "PGRST205" || error.code === "PGRST204") {
      return [];
    }
    throw error;
  }

  return (data ?? [])
    .map((row) => row.company_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

async function getEligibleCompanyIdsForRequest(request: Request) {
  const services = await fetchPublicMapServices();
  const radiusKm = Math.max(0, Number(request.distanceKm) || 0);

  return services
    .filter((service) =>
      isRequestVisibleToCompany(
        request,
        service.id,
        mapServiceToLocation(service),
        radiusKm > 0 ? radiusKm : 50,
      ),
    )
    .map((service) => service.id);
}

async function requestHasActiveServiceOffer(requestId: string) {
  const appointments = await fetchAppointmentsForRequestIds([requestId]);
  return appointments.some(
    (appointment) => appointment.status === "pending" || appointment.status === "accepted",
  );
}

export async function closeRequestAsNoServiceAccepted(request: Request) {
  if (request.status !== "inquiry") {
    return false;
  }

  if (await requestHasActiveServiceOffer(request.id)) {
    return false;
  }

  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from("requests")
    .update({
      status: "cancelled",
      cancel_reason: request.targetCompanyId ? null : "no_service_accepted",
      status_before_cancel: "inquiry",
      updated_at: updatedAt,
    })
    .eq("id", request.id)
    .eq("status", "inquiry");

  if (error) {
    if (error.code === "PGRST204") {
      throw new Error(
        "Chýba podpora dôvodu zrušenia. Spustite supabase/add-request-service-declines.sql.",
      );
    }
    throw error;
  }

  return true;
}

async function upsertServiceDecline(requestId: string, companyId: string) {
  const { error } = await supabase.from("request_service_declines").upsert(
    {
      request_id: requestId,
      company_id: companyId,
      declined_at: new Date().toISOString(),
    },
    { onConflict: "request_id,company_id" },
  );

  if (error) {
    if (error.code === "PGRST205" || error.code === "PGRST204") {
      throw new Error(
        "Chýba tabuľka request_service_declines. Spustite supabase/add-request-service-declines.sql.",
      );
    }
    throw error;
  }
}

function findCompanyPendingAppointment(
  appointments: Awaited<ReturnType<typeof fetchAppointmentsForRequestIds>>,
  companyName: string,
) {
  const normalizedCompany = companyName.trim().toLowerCase();
  const pendingAppointments = appointments.filter(
    (appointment) => appointment.status === "pending",
  );

  if (pendingAppointments.length === 0) {
    return null;
  }

  if (normalizedCompany) {
    const matched = pendingAppointments.find((appointment) => {
      const appointmentCompany = appointment.companyName?.trim().toLowerCase() ?? "";
      return appointmentCompany === normalizedCompany;
    });
    if (matched) {
      return matched;
    }
  }

  return pendingAppointments.length === 1 ? pendingAppointments[0] : null;
}

export async function withdrawWaitingOfferForService(
  request: Request,
  companyId: string,
  companyName: string,
) {
  const trimmedCompanyId = companyId.trim();
  if (!trimmedCompanyId) {
    throw new Error("Chýba identifikátor servisu.");
  }

  if (request.status !== "waiting") {
    throw new Error("Tento dopyt nie je v stave čakania na potvrdenie.");
  }

  const appointments = await fetchAppointmentsForRequestIds([request.id]);
  const pendingAppointment = findCompanyPendingAppointment(appointments, companyName);

  if (!pendingAppointment) {
    throw new Error("Ponuka termínu sa nenašla alebo už bola stiahnutá.");
  }

  await rejectCustomerAppointment(pendingAppointment.id);
  await upsertServiceDecline(request.id, trimmedCompanyId);

  const refreshed = await fetchRequestById(request.id);
  if (refreshed?.status === "inquiry") {
    await maybeCloseRequestAfterServiceDecline(refreshed, trimmedCompanyId);
  }
}

export async function removeRequestFromServiceDashboard(
  request: Request,
  companyId: string,
  companyName: string,
) {
  if (request.status === "inquiry") {
    await declineRequestForService(request, companyId);
    return;
  }

  if (request.status === "waiting") {
    await withdrawWaitingOfferForService(request, companyId, companyName);
    return;
  }

  throw new Error("Tento dopyt už nie je možné odstrániť zo zoznamu.");
}

async function maybeCloseRequestAfterServiceDecline(request: Request, companyId: string) {
  if (request.status !== "inquiry") {
    return;
  }

  if (await requestHasActiveServiceOffer(request.id)) {
    return;
  }

  if (request.targetCompanyId) {
    if (request.targetCompanyId === companyId) {
      await closeRequestAsNoServiceAccepted(request);
    }
    return;
  }

  const eligibleCompanyIds = await getEligibleCompanyIdsForRequest(request);
  if (eligibleCompanyIds.length === 0) {
    return;
  }

  const declinedCompanyIds = await fetchDeclinedCompanyIdsForRequest(request.id);
  const declinedSet = new Set(declinedCompanyIds);
  const allDeclined = eligibleCompanyIds.every((id) => declinedSet.has(id));

  if (allDeclined) {
    await closeRequestAsNoServiceAccepted(request);
  }
}

export async function declineRequestForService(request: Request, companyId: string) {
  const trimmedCompanyId = companyId.trim();
  if (!trimmedCompanyId) {
    throw new Error("Chýba identifikátor servisu.");
  }

  if (request.status !== "inquiry") {
    throw new Error("Tento dopyt už nie je možné odmietnuť.");
  }

  await upsertServiceDecline(request.id, trimmedCompanyId);

  await maybeCloseRequestAfterServiceDecline(request, trimmedCompanyId);
}

export function getRequestClosureMessage(
  request: Pick<Request, "status" | "cancelReason" | "targetCompanyId">,
) {
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
    return getExpiredInquiryClosureMessage();
  }

  return null;
}
