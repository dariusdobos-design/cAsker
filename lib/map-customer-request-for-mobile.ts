import type { CustomerRequestWithResponses } from "@/lib/customer-request-responses";

/** Stabilný tvar odpovede pre mobilnú appku (camelCase). */
export function mapCustomerRequestForMobile(request: CustomerRequestWithResponses) {
  return {
    id: request.id,
    status: request.status,
    requestCategory: request.requestCategory,
    vehicleName: request.vehicleName,
    vehicleTitle: request.vehicleTitle,
    licensePlate: request.licensePlate,
    locationCity: request.locationCity,
    service: request.service,
    year: request.year,
    inquiryDescription: request.inquiryDescription,
    inquiryPhotos: request.inquiryPhotos ?? [],
    createdAt: request.createdAt,
    cancelReason: request.cancelReason ?? null,
    targetCompanyId: request.targetCompanyId ?? null,
    completedWork: request.completedWork ?? null,
    vehiclePickupNote: request.vehiclePickupNote ?? null,
    customerPickupConfirmedAt: request.customerPickupConfirmedAt ?? null,
    rescheduleRequestedAt: request.rescheduleRequestedAt ?? null,
    unreadChatCount: request.unreadChatCount ?? 0,
    serviceResponses: (request.serviceResponses ?? []).map((response) => ({
      id: response.id,
      requestId: response.requestId,
      serviceName: response.serviceName,
      serviceAddress: response.serviceAddress,
      serviceLatitude: response.serviceLatitude,
      serviceLongitude: response.serviceLongitude,
      appointmentDate: response.appointmentDate,
      appointmentTime: response.appointmentTime,
      scheduleLabel: response.scheduleLabel,
      message: response.message,
      status: response.status,
      createdAt: response.createdAt,
    })),
  };
}
