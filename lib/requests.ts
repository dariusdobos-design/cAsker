import { supabase } from "./supabase";
import { sendCustomerCompletionNotification } from "./customer-notifications";

export type DashboardState =
  | "inquiry"
  | "waiting"
  | "done"
  | "completed"
  | "cancelled"
  | "expired";

export type ActiveDashboardState = "inquiry" | "waiting" | "done";

export type RestorableRequestStatus = ActiveDashboardState;

export type VehicleCategory = "car" | "van";

export type RequestCategory = "auto" | "tire" | "towing";

export type Request = {
  id: string;
  status: DashboardState;
  requestCategory: RequestCategory;
  vehicleCategory: VehicleCategory;
  vehicleName: string;
  vehicleTitle: string;
  service: string;
  licensePlate: string;
  distanceKm: number;
  locationCity: string;
  vin: string;
  engineVolume: string;
  power: string;
  fuelType: string;
  year: number;
  engine: string;
  drive: string;
  bodyType: string;
  doors: number;
  mileageKm: number;
  transmission: string;
  inquiryDescription: string;
  userName: string;
  phone: string;
  createdAt: string;
  rescheduleRequestedAt?: string | null;
  customerAcceptedAt?: string | null;
  serviceAcceptedSeenAt?: string | null;
  serviceInquirySeenAt?: string | null;
  statusBeforeCancel?: RestorableRequestStatus | null;
  completedWork?: string | null;
  vehiclePickupNote?: string | null;
};

type RequestRow = {
  id: string;
  status: DashboardState;
  request_category?: RequestCategory | null;
  vehicle_category?: VehicleCategory | null;
  vehicle_name: string;
  vehicle_title: string;
  service: string;
  license_plate: string;
  distance_km: number;
  location_city: string;
  vin: string;
  engine_volume: string;
  power: string;
  fuel_type: string;
  year: number;
  engine: string;
  drive: string;
  body_type: string;
  doors: number;
  mileage_km: number;
  transmission: string;
  inquiry_description: string;
  user_name: string;
  phone: string;
  created_at?: string;
  reschedule_requested_at?: string | null;
  customer_accepted_at?: string | null;
  service_accepted_seen_at?: string | null;
  service_inquiry_seen_at?: string | null;
  status_before_cancel?: RestorableRequestStatus | null;
  completed_work?: string | null;
  vehicle_pickup_note?: string | null;
};

function normalizeVehicleCategory(value?: VehicleCategory | null): VehicleCategory {
  return value === "van" ? "van" : "car";
}

export function parseRequestCategory(
  value?: RequestCategory | string | null,
): RequestCategory {
  if (value === "auto" || value === "tire" || value === "towing") return value;
  // Len staré riadky v DB alebo legacy SELECT bez stĺpca request_category.
  return "auto";
}

/** @deprecated Použi parseRequestCategory — názov ponechaný kvôli importom. */
export const normalizeRequestCategory = parseRequestCategory;

export function getRequestCategoryCardClass(category: RequestCategory): string {
  if (category === "tire") return "is-category-tire";
  if (category === "towing") return "is-category-towing";
  return "";
}

export function formatRequestCategoryLabel(category: RequestCategory) {
  if (category === "tire") return "Pneuservis";
  if (category === "towing") return "Odťahová služba";
  return "Autoservis";
}

export function formatVehicleCategoryLabel(category: VehicleCategory) {
  return category === "van" ? "Úžitkové vozidlo" : "Osobné auto";
}

export function formatDriveLabel(drive: string) {
  const normalized = drive.trim().toLowerCase();

  if (
    normalized === "fwd" ||
    normalized === "front" ||
    normalized === "predný" ||
    normalized === "predny" ||
    normalized === "predna"
  ) {
    return "Predný";
  }

  if (
    normalized === "rwd" ||
    normalized === "rear" ||
    normalized === "zadný" ||
    normalized === "zadny" ||
    normalized === "zadna"
  ) {
    return "Zadný";
  }

  if (
    normalized === "4x4" ||
    normalized === "4wd" ||
    normalized === "awd" ||
    normalized === "all-wheel" ||
    normalized === "all wheel drive"
  ) {
    return "4x4";
  }

  return drive;
}

export function isElectricVehicle(request: Pick<Request, "fuelType">) {
  const normalized = request.fuelType.trim().toLowerCase();
  return (
    normalized === "elektrik" ||
    normalized === "electric" ||
    normalized === "elektrina" ||
    normalized === "bev"
  );
}

function buildFallbackCreatedAt(id: string) {
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return new Date().toISOString();
  }

  const createdAt = new Date(Date.UTC(2026, 4, 20, 8, 0, 0));
  createdAt.setHours(createdAt.getHours() + numericId - 1);
  createdAt.setMinutes((numericId * 11) % 60);
  return createdAt.toISOString();
}

function withRequestDefaults(
  request: Omit<Request, "vehicleCategory" | "createdAt"> &
    Partial<Pick<Request, "vehicleCategory" | "createdAt">>,
): Request {
  return {
    ...request,
    vehicleCategory: normalizeVehicleCategory(request.vehicleCategory),
    createdAt: request.createdAt ?? buildFallbackCreatedAt(request.id),
  };
}

export function formatRequestCreatedTime(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("sk-SK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatRequestCreatedLabel(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";

  const datePart = date.toLocaleDateString("sk-SK", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString("sk-SK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${datePart} · ${timePart}`;
}

type RequestSearchAppointment = {
  customer_name?: string;
  vehicle_info?: string;
  appointment_date?: string;
  appointment_time?: string;
};

function normalizeRequestSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRequestSearchPlate(value: string) {
  return normalizeRequestSearchText(value).replace(/[^a-z0-9]/g, "");
}

function buildRequestSearchHaystacks(
  request: Request,
  appointment?: RequestSearchAppointment | null,
) {
  return [
    request.vehicleName,
    request.vehicleTitle,
    request.service,
    request.licensePlate,
    request.locationCity,
    request.inquiryDescription,
    request.userName,
    request.phone,
    request.vin,
    request.engine,
    request.fuelType,
    request.transmission,
    request.bodyType,
    request.drive,
    String(request.year),
    appointment?.customer_name,
    appointment?.vehicle_info,
    appointment?.appointment_date,
    appointment?.appointment_time,
  ]
    .filter((value): value is string => Boolean(value && String(value).trim()))
    .map((value) => normalizeRequestSearchText(String(value)));
}

export function matchesRequestSearchQuery(
  request: Request,
  rawQuery: string,
  appointment?: RequestSearchAppointment | null,
): boolean {
  const query = normalizeRequestSearchText(rawQuery);
  if (!query) return true;

  const haystacks = buildRequestSearchHaystacks(request, appointment);
  const plateHaystack = normalizeRequestSearchPlate(
    `${request.licensePlate} ${request.vin}`,
  );
  const tokens = query.split(" ").filter(Boolean);

  return tokens.every((token) => {
    const plateToken = normalizeRequestSearchPlate(token);
    if (plateToken.length > 0 && plateHaystack.includes(plateToken)) {
      return true;
    }
    return haystacks.some((haystack) => haystack.includes(token));
  });
}

export function compareRequestsByCreatedAt(left: Request, right: Request) {
  const timeDiff =
    new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  if (timeDiff !== 0) return timeDiff;
  return left.id.localeCompare(right.id, undefined, { numeric: true });
}

export function sortRequestsByCreatedAt<T extends Request>(requests: T[]) {
  return [...requests].sort(compareRequestsByCreatedAt);
}

export function groupRequestsByCreatedDate(requests: Request[]) {
  const groups = new Map<string, Request[]>();

  for (const request of sortRequestsByCreatedAt(requests)) {
    const dateKey = toHistoryDateKey(request.createdAt);
    const bucket = groups.get(dateKey) ?? [];
    bucket.push(request);
    groups.set(dateKey, bucket);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dateKey, items]) => ({
      dateKey,
      label: formatHistoryDateLabel(dateKey),
      requests: items,
    }));
}

function mapRequestRow(row: RequestRow): Request {
  return {
    id: row.id,
    status: row.status,
    requestCategory: parseRequestCategory(row.request_category),
    vehicleCategory: normalizeVehicleCategory(row.vehicle_category),
    vehicleName: row.vehicle_name,
    vehicleTitle: row.vehicle_title,
    service: row.service,
    licensePlate: row.license_plate,
    distanceKm: Number(row.distance_km),
    locationCity: row.location_city,
    vin: row.vin,
    engineVolume: row.engine_volume,
    power: row.power,
    fuelType: row.fuel_type,
    year: row.year,
    engine: row.engine,
    drive: row.drive,
    bodyType: row.body_type,
    doors: row.doors,
    mileageKm: row.mileage_km,
    transmission: row.transmission,
    inquiryDescription: row.inquiry_description,
    userName: row.user_name,
    phone: row.phone,
    createdAt: row.created_at ?? buildFallbackCreatedAt(row.id),
    rescheduleRequestedAt: row.reschedule_requested_at ?? null,
    customerAcceptedAt: row.customer_accepted_at ?? null,
    serviceAcceptedSeenAt: row.service_accepted_seen_at ?? null,
    serviceInquirySeenAt: row.service_inquiry_seen_at ?? null,
    statusBeforeCancel: row.status_before_cancel ?? null,
    completedWork: row.completed_work ?? null,
    vehiclePickupNote: row.vehicle_pickup_note ?? null,
  };
}

function requestToRow(request: Request, updatedAt?: string) {
  return {
    id: request.id,
    status: request.status,
    request_category: request.requestCategory,
    vehicle_category: request.vehicleCategory,
    vehicle_name: request.vehicleName,
    vehicle_title: request.vehicleTitle,
    service: request.service,
    license_plate: request.licensePlate,
    distance_km: request.distanceKm,
    location_city: request.locationCity,
    vin: request.vin,
    engine_volume: request.engineVolume,
    power: request.power,
    fuel_type: request.fuelType,
    year: request.year,
    engine: request.engine,
    drive: request.drive,
    body_type: request.bodyType,
    doors: request.doors,
    mileage_km: request.mileageKm,
    transmission: request.transmission,
    inquiry_description: request.inquiryDescription,
    user_name: request.userName,
    phone: request.phone,
    ...(request.statusBeforeCancel
      ? { status_before_cancel: request.statusBeforeCancel }
      : {}),
    ...(request.completedWork ? { completed_work: request.completedWork } : {}),
    ...(request.vehiclePickupNote
      ? { vehicle_pickup_note: request.vehiclePickupNote }
      : {}),
    ...(updatedAt ? { updated_at: updatedAt } : {}),
  };
}

export async function upsertRequest(request: Request, updatedAt?: string) {
  const timestamp = updatedAt ?? new Date().toISOString();
  const { error } = await supabase
    .from("requests")
    .upsert(requestToRow(request, timestamp), { onConflict: "id" });

  if (error) throw error;
}

export async function upsertRequests(requests: Request[]) {
  if (requests.length === 0) return;

  const { error } = await supabase
    .from("requests")
    .upsert(requests.map((request) => requestToRow(request)), { onConflict: "id" });

  if (error) throw error;
}

const REQUEST_SELECT_FIELDS =
  "id, status, request_category, vehicle_category, vehicle_name, vehicle_title, service, license_plate, distance_km, location_city, vin, engine_volume, power, fuel_type, year, engine, drive, body_type, doors, mileage_km, transmission, inquiry_description, user_name, phone, created_at, reschedule_requested_at, customer_accepted_at, service_accepted_seen_at, service_inquiry_seen_at, status_before_cancel";

const REQUEST_SELECT_FIELDS_LEGACY =
  "id, status, vehicle_category, vehicle_name, vehicle_title, service, license_plate, distance_km, location_city, vin, engine_volume, power, fuel_type, year, engine, drive, body_type, doors, mileage_km, transmission, inquiry_description, user_name, phone, created_at";

export async function fetchRequestById(requestId: string) {
  const { data, error } = await supabase
    .from("requests")
    .select(REQUEST_SELECT_FIELDS)
    .eq("id", requestId)
    .maybeSingle();

  if (error?.code === "PGRST204") {
    const fallback = await supabase
      .from("requests")
      .select(REQUEST_SELECT_FIELDS_LEGACY)
      .eq("id", requestId)
      .maybeSingle();
    if (fallback.error) throw fallback.error;
    if (!fallback.data) return null;
    return mapRequestRow(fallback.data as RequestRow);
  }

  if (error) throw error;
  if (!data) return null;

  return mapRequestRow(data as RequestRow);
}

export async function fetchRequestsByIds(requestIds: string[]) {
  const ids = Array.from(new Set(requestIds.map((id) => id.trim()).filter(Boolean)));
  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("requests")
    .select(REQUEST_SELECT_FIELDS)
    .in("id", ids)
    .order("created_at", { ascending: false });

  if (error?.code === "PGRST204") {
    const fallback = await supabase
      .from("requests")
      .select(REQUEST_SELECT_FIELDS_LEGACY)
      .in("id", ids)
      .order("created_at", { ascending: false });
    if (fallback.error) throw fallback.error;
    return ((fallback.data ?? []) as RequestRow[]).map(mapRequestRow);
  }

  if (error) throw error;
  return ((data ?? []) as RequestRow[]).map(mapRequestRow);
}

export async function fetchRequests(options?: { allowFallback?: boolean }) {
  const { data, error } = await supabase
    .from("requests")
    .select(REQUEST_SELECT_FIELDS)
    .order("created_at", { ascending: true });

  if (error?.code === "PGRST204") {
    const fallback = await supabase
      .from("requests")
      .select(REQUEST_SELECT_FIELDS_LEGACY)
      .order("created_at", { ascending: true });
    if (fallback.error) {
      if (fallback.error.code === "PGRST205" && options?.allowFallback !== false) {
        return sortRequestsByCreatedAt(FALLBACK_REQUESTS);
      }
      throw fallback.error;
    }
    const fromDb = ((fallback.data ?? []) as RequestRow[]).map(mapRequestRow);
    return sortRequestsByCreatedAt(
      fromDb.filter((request) => !isArchivedRequestStatus(request.status)),
    );
  }

  if (error) {
    if (error.code === "PGRST205" && options?.allowFallback !== false) {
      return sortRequestsByCreatedAt(FALLBACK_REQUESTS);
    }
    throw error;
  }

  const fromDb = ((data ?? []) as RequestRow[]).map(mapRequestRow);
  const knownIds = new Set(fromDb.map((request) => request.id));
  const missingFallback = FALLBACK_REQUESTS.filter(
    (request) => !knownIds.has(request.id),
  );

  if (missingFallback.length > 0) {
    try {
      await upsertRequests(missingFallback);
    } catch (syncError) {
      console.warn("Nepodarilo sa synchronizovať demo dopyty do DB:", syncError);
    }
  }

  return sortRequestsByCreatedAt(
    [...fromDb, ...missingFallback].filter(
      (request) => !isArchivedRequestStatus(request.status),
    ),
  );
}

export type CompleteRequestPayload = {
  completedWork: string;
  vehiclePickupNote?: string;
};

export async function completeRequest(
  request: Request,
  payload: CompleteRequestPayload,
) {
  const trimmedWork = payload.completedWork.trim();
  if (!trimmedWork) {
    throw new Error("Popíšte, čo sa na vozidle robilo.");
  }

  const trimmedPickup = payload.vehiclePickupNote?.trim() ?? "";

  const updatedAt = new Date().toISOString();
  const updatePayload = {
    status: "completed" as const,
    completed_work: trimmedWork,
    vehicle_pickup_note: trimmedPickup || null,
    updated_at: updatedAt,
  };

  let { error: updateError } = await supabase
    .from("requests")
    .update(updatePayload)
    .eq("id", request.id);

  if (updateError?.code === "PGRST204") {
    ({ error: updateError } = await supabase
      .from("requests")
      .update({ status: "completed", updated_at: updatedAt })
      .eq("id", request.id));
  }

  if (updateError) throw updateError;

  await sendCustomerCompletionNotification(request, trimmedWork, trimmedPickup);

  const { data: verified, error: verifyError } = await supabase
    .from("requests")
    .select("status")
    .eq("id", request.id)
    .maybeSingle();

  if (verifyError) throw verifyError;

  if (verified?.status === "completed") return;

  await upsertRequest(
    {
      ...request,
      status: "completed",
      completedWork: trimmedWork,
      vehiclePickupNote: trimmedPickup || null,
    },
    updatedAt,
  );
}

function isArchivedRequestStatus(status: DashboardState) {
  return (
    status === "completed" ||
    status === "cancelled" ||
    status === "expired"
  );
}

function getRestorableStatus(request: Request): RestorableRequestStatus {
  if (
    request.status === "inquiry" ||
    request.status === "waiting" ||
    request.status === "done"
  ) {
    return request.status;
  }

  return "inquiry";
}

export function getActiveStateLabel(status: RestorableRequestStatus) {
  switch (status) {
    case "inquiry":
      return "Dopyt";
    case "waiting":
      return "Čaká";
    case "done":
      return "Prijaté";
  }
}

export async function cancelRequest(request: Request) {
  const statusBeforeCancel = getRestorableStatus(request);
  const updatedAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("requests")
    .update({
      status: "cancelled",
      status_before_cancel: statusBeforeCancel,
      updated_at: updatedAt,
    })
    .eq("id", request.id);

  if (updateError) {
    if (updateError.code === "PGRST204") {
      throw new Error(
        "Chýba podpora zrušených dopytov. Spustite migráciu supabase/add-cancelled-status.sql.",
      );
    }
    throw updateError;
  }

  const { data: verified, error: verifyError } = await supabase
    .from("requests")
    .select("status")
    .eq("id", request.id)
    .maybeSingle();

  if (verifyError) throw verifyError;

  if (verified?.status === "cancelled") return;

  await upsertRequest(
    {
      ...request,
      status: "cancelled",
      statusBeforeCancel,
    },
    updatedAt,
  );
}

export async function restoreRequest(request: CancelledRequest) {
  await assertCancelledRequestIsRestorable(request);

  const restoredStatus = request.statusBeforeCancel ?? "inquiry";
  const updatedAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("requests")
    .update({
      status: restoredStatus,
      status_before_cancel: null,
      updated_at: updatedAt,
    })
    .eq("id", request.id);

  if (updateError) {
    if (updateError.code === "PGRST204") {
      throw new Error(
        "Chýba podpora obnovy dopytov. Spustite migráciu supabase/add-cancelled-status.sql.",
      );
    }
    throw updateError;
  }

  const { data: verified, error: verifyError } = await supabase
    .from("requests")
    .select("status")
    .eq("id", request.id)
    .maybeSingle();

  if (verifyError) throw verifyError;

  if (verified?.status === restoredStatus) return;

  await upsertRequest(
    {
      ...request,
      status: restoredStatus,
      statusBeforeCancel: null,
    },
    updatedAt,
  );
}

export async function updateRequestStatus(
  requestId: string,
  status: DashboardState,
) {
  const { error } = await supabase
    .from("requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) throw error;
}

export function hasCustomerRescheduleRequest(
  request: Pick<Request, "rescheduleRequestedAt">,
  appointment?: { reschedule_requested_at?: string | null } | null,
) {
  return Boolean(request.rescheduleRequestedAt || appointment?.reschedule_requested_at);
}

export function hasUnseenCustomerAcceptance(
  request: Pick<
    Request,
    "status" | "customerAcceptedAt" | "serviceAcceptedSeenAt"
  >,
) {
  return (
    request.status === "done" &&
    Boolean(request.customerAcceptedAt) &&
    !request.serviceAcceptedSeenAt
  );
}

export function hasUnseenInquiry(
  request: Pick<Request, "status" | "serviceInquirySeenAt">,
) {
  return request.status === "inquiry" && !request.serviceInquirySeenAt;
}

export async function acknowledgeCustomerAcceptance(requestId: string) {
  const timestamp = new Date().toISOString();
  const { error } = await supabase
    .from("requests")
    .update({
      service_accepted_seen_at: timestamp,
      updated_at: timestamp,
    })
    .eq("id", requestId)
    .eq("status", "done");

  if (error?.code === "PGRST204") return;
  if (error) throw error;
}

export async function acknowledgeInquiry(requestId: string) {
  const timestamp = new Date().toISOString();
  const { error } = await supabase
    .from("requests")
    .update({
      service_inquiry_seen_at: timestamp,
      updated_at: timestamp,
    })
    .eq("id", requestId)
    .eq("status", "inquiry");

  if (error?.code === "PGRST204") return;
  if (error) throw error;
}

export function getCustomerRescheduleRequestedAt(
  request: Pick<Request, "rescheduleRequestedAt">,
  appointment?: { reschedule_requested_at?: string | null } | null,
): string | null {
  return request.rescheduleRequestedAt ?? appointment?.reschedule_requested_at ?? null;
}

export async function setRequestRescheduleRequested(requestId: string) {
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("requests")
    .update({
      reschedule_requested_at: timestamp,
      updated_at: timestamp,
    })
    .eq("id", requestId)
    .select("id, reschedule_requested_at");

  if (error) {
    if (error.code === "PGRST204") {
      throw new Error(
        "Chýba stĺpec reschedule_requested_at. Spustite migráciu supabase/add-request-reschedule-requested.sql.",
      );
    }
    throw error;
  }

  if (!data?.[0]?.reschedule_requested_at) {
    throw new Error("Žiadosť o zmenu termínu sa nepodarilo uložiť.");
  }

  return data[0].reschedule_requested_at as string;
}

export async function clearRequestRescheduleRequested(requestId: string) {
  const { error } = await supabase
    .from("requests")
    .update({
      reschedule_requested_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error?.code === "PGRST204") return;
  if (error) throw error;
}

export type ArchivedRequest = Request & {
  archivedAt: string;
};

export type CompletedRequest = ArchivedRequest & {
  completedAt: string;
};

export type CancelledRequest = ArchivedRequest & {
  cancelledAt: string;
  statusBeforeCancel: RestorableRequestStatus | null;
};

type RequestRowWithTimestamps = RequestRow & {
  created_at?: string;
  updated_at?: string;
};

export function formatHistoryDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}

export function formatHistoryDateTimeLabel(isoDate: string) {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate;

  const datePart = formatHistoryDateLabel(toHistoryDateKey(isoDate));
  const timePart = `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;

  return `${datePart} · ${timePart}`;
}

export class RequestNoLongerCurrentError extends Error {
  constructor(message = "Dopyt je už neaktuálny.") {
    super(message);
    this.name = "RequestNoLongerCurrentError";
  }
}

export function isRequestNoLongerCurrentError(error: unknown) {
  return error instanceof RequestNoLongerCurrentError;
}

function formatRequestVehicleInfo(
  request: Pick<Request, "vehicleName" | "year" | "licensePlate">,
) {
  return `${request.vehicleName} ${request.year} - EC-${request.licensePlate}`;
}

async function assertCancelledRequestIsRestorable(request: CancelledRequest) {
  if (!(await isCancelledRequestRestorable(request))) {
    throw new RequestNoLongerCurrentError();
  }
}

export async function isCancelledRequestRestorable(request: CancelledRequest) {
  const { data: conflictingRequests, error: requestsError } = await supabase
    .from("requests")
    .select("id, status")
    .neq("id", request.id)
    .eq("vin", request.vin)
    .eq("license_plate", request.licensePlate)
    .eq("user_name", request.userName);

  if (requestsError) throw requestsError;

  const hasActiveDuplicate = (conflictingRequests ?? []).some(
    (row) => row.status !== "cancelled" && row.status !== "expired",
  );

  if (hasActiveDuplicate) return false;

  const vehicleInfo = formatRequestVehicleInfo(request);
  const { data: acceptedAppointments, error: appointmentsError } = await supabase
    .from("appointments")
    .select("request_id, customer_name, vehicle_info")
    .eq("status", "accepted")
    .eq("customer_name", request.userName)
    .eq("vehicle_info", vehicleInfo);

  if (appointmentsError) {
    if (appointmentsError.code === "PGRST205" || appointmentsError.code === "PGRST204") {
      return true;
    }
    throw appointmentsError;
  }

  return !(acceptedAppointments ?? []).some(
    (appointment) => appointment.request_id !== request.id,
  );
}

export async function purgeStaleCancelledRequest(
  request: CancelledRequest,
): Promise<boolean> {
  if (await isCancelledRequestRestorable(request)) return false;

  const { error } = await supabase
    .from("requests")
    .update({
      status: "expired",
      updated_at: new Date().toISOString(),
    })
    .eq("id", request.id)
    .eq("status", "cancelled");

  if (error) {
    if (error.code === "PGRST204" || error.message.includes("expired")) {
      throw new Error(
        "Chýba stav expired pre odstránenie neaktuálnych dopytov. Spustite migráciu supabase/add-expired-status.sql.",
      );
    }
    throw error;
  }

  return true;
}

export async function syncCancelledRequests() {
  const cancelled = await fetchCancelledRequests();
  const kept: CancelledRequest[] = [];

  for (const request of cancelled) {
    try {
      const purged = await purgeStaleCancelledRequest(request);
      if (!purged) kept.push(request);
    } catch (error) {
      console.warn(
        "Neaktuálny zrušený dopyt sa nepodarilo odstrániť:",
        request.id,
        error,
      );
      kept.push(request);
    }
  }

  return kept;
}

export function toHistoryDateKey(isoDate: string) {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate.slice(0, 10);

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function groupArchivedRequestsByDate<T extends ArchivedRequest>(requests: T[]) {
  const groups = new Map<string, T[]>();

  for (const request of requests) {
    const dateKey = toHistoryDateKey(request.archivedAt);
    const bucket = groups.get(dateKey) ?? [];
    bucket.push(request);
    groups.set(dateKey, bucket);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([dateKey, items]) => ({
      dateKey,
      label: formatHistoryDateLabel(dateKey),
      requests: items,
    }));
}

export function groupCompletedRequestsByDate(requests: CompletedRequest[]) {
  return groupArchivedRequestsByDate(
    requests.map((request) => ({
      ...request,
      archivedAt: request.completedAt,
    })),
  );
}

export function groupCancelledRequestsByDate(requests: CancelledRequest[]) {
  return groupArchivedRequestsByDate(
    requests.map((request) => ({
      ...request,
      archivedAt: request.cancelledAt,
    })),
  );
}

export async function fetchCancelledRequests() {
  const { data, error } = await supabase
    .from("requests")
    .select(
      "id, status, vehicle_category, vehicle_name, vehicle_title, service, license_plate, distance_km, location_city, vin, engine_volume, power, fuel_type, year, engine, drive, body_type, doors, mileage_km, transmission, inquiry_description, user_name, phone, created_at, updated_at, status_before_cancel",
    )
    .eq("status", "cancelled")
    .order("updated_at", { ascending: false });

  if (error) {
    if (error.code === "PGRST205" || error.code === "PGRST204") return [];
    throw error;
  }

  const cancelled = ((data ?? []) as RequestRowWithTimestamps[]).map((row) => {
    const archivedAt = row.updated_at ?? row.created_at ?? new Date().toISOString();
    return {
      ...mapRequestRow(row),
      archivedAt,
      cancelledAt: archivedAt,
      statusBeforeCancel: row.status_before_cancel ?? null,
    };
  });

  return cancelled.sort((left, right) => {
    const timeDiff =
      new Date(right.cancelledAt).getTime() - new Date(left.cancelledAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return right.id.localeCompare(left.id, undefined, { numeric: true });
  });
}

export async function fetchCompletedRequests() {
  const { data, error } = await supabase
    .from("requests")
    .select(
      "id, status, vehicle_category, vehicle_name, vehicle_title, service, license_plate, distance_km, location_city, vin, engine_volume, power, fuel_type, year, engine, drive, body_type, doors, mileage_km, transmission, inquiry_description, user_name, phone, created_at, updated_at, completed_work, vehicle_pickup_note",
    )
    .eq("status", "completed")
    .order("updated_at", { ascending: false });

  if (error) {
    if (error.code === "PGRST204") {
      const fallback = await supabase
        .from("requests")
        .select(
          "id, status, vehicle_category, vehicle_name, vehicle_title, service, license_plate, distance_km, location_city, vin, engine_volume, power, fuel_type, year, engine, drive, body_type, doors, mileage_km, transmission, inquiry_description, user_name, phone, created_at, updated_at",
        )
        .eq("status", "completed")
        .order("updated_at", { ascending: false });
      if (fallback.error) {
        if (fallback.error.code === "PGRST205") return [];
        throw fallback.error;
      }
      return ((fallback.data ?? []) as RequestRowWithTimestamps[]).map((row) => {
        const archivedAt = row.updated_at ?? row.created_at ?? new Date().toISOString();
        return {
          ...mapRequestRow(row),
          archivedAt,
          completedAt: archivedAt,
        };
      });
    }
    if (error.code === "PGRST205") return [];
    throw error;
  }

  const completed = ((data ?? []) as RequestRowWithTimestamps[]).map((row) => {
    const archivedAt = row.updated_at ?? row.created_at ?? new Date().toISOString();
    return {
      ...mapRequestRow(row),
      archivedAt,
      completedAt: archivedAt,
    };
  });

  return completed.sort((left, right) => {
    const timeDiff =
      new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return right.id.localeCompare(left.id, undefined, { numeric: true });
  });
}

export const FALLBACK_REQUESTS: Request[] = [
  withRequestDefaults({
    id: "1",
    status: "inquiry",
    requestCategory: "auto",
    vehicleName: "Škoda Octavia",
    vehicleTitle: "Škoda Octavia 2.0 TSI",
    service: "Výmena oleja + filtrov",
    licensePlate: "AA970VG",
    distanceKm: 13.4,
    locationCity: "Bytča",
    vin: "TMBBS21Z802123456",
    engineVolume: "1.9 l",
    power: "77 kW",
    fuelType: "Diesel",
    year: 2004,
    engine: "2.0 TSI",
    drive: "FWD",
    bodyType: "Combi",
    doors: 5,
    mileageKm: 173651,
    transmission: "Manuálna",
    inquiryDescription:
      "Potrebujem skontrolovať vozidlo, či je na ňom bezpečne jazdiť do doby opravy.",
    userName: "Ján Novák",
    phone: "+421 905 123 456",
  }),
  withRequestDefaults({
    id: "2",
    status: "done",
    requestCategory: "auto",
    vehicleName: "VW Golf",
    vehicleTitle: "VW Golf 1.4 TSI",
    service: "Diagnostika motora",
    licensePlate: "ZA123AB",
    distanceKm: 8.2,
    locationCity: "Žilina",
    vin: "WVWZZZ1KZ6W386752",
    engineVolume: "1.4 l",
    power: "90 kW",
    fuelType: "Benzín",
    year: 2016,
    engine: "1.4 TSI",
    drive: "FWD",
    bodyType: "Hatchback",
    doors: 5,
    mileageKm: 98420,
    transmission: "Automatická",
    inquiryDescription:
      "Motor občas cuká pri studenom štarte, chcem vedieť príčinu a odhad opravy.",
    userName: "Mária Kováčová",
    phone: "+421 911 987 654",
  }),
  withRequestDefaults({
    id: "3",
    status: "done",
    requestCategory: "auto",
    vehicleName: "Ford Focus",
    vehicleTitle: "Ford Focus 1.6 Ti-VCT",
    service: "Výmena brzdových doštičiek",
    licensePlate: "BL456CD",
    distanceKm: 21.7,
    locationCity: "Martin",
    vin: "WF0AXXWPMA1234567",
    engineVolume: "1.6 l",
    power: "85 kW",
    fuelType: "Benzín",
    year: 2012,
    engine: "1.6 Ti-VCT",
    drive: "FWD",
    bodyType: "Combi",
    doors: 5,
    mileageKm: 142300,
    transmission: "Manuálna",
    inquiryDescription:
      "Pískanie pri brzdení, prosím o kontrolu a výmenu doštičiek.",
    userName: "Peter Horváth",
    phone: "+421 948 222 333",
  }),
  withRequestDefaults({
    id: "4",
    status: "inquiry",
    requestCategory: "auto",
    vehicleName: "BMW 320d",
    vehicleTitle: "BMW 320d xDrive",
    service: "Kontrola klimatizácie",
    licensePlate: "TN789EF",
    distanceKm: 142.5,
    locationCity: "Poprad",
    vin: "WBA8E310X0A123456",
    engineVolume: "2.0 l",
    power: "140 kW",
    fuelType: "Diesel",
    year: 2018,
    engine: "2.0 d",
    drive: "4x4",
    bodyType: "Sedan",
    doors: 4,
    mileageKm: 86500,
    transmission: "Automatická",
    inquiryDescription:
      "Klimatizácia nechladí dostatočne, prosím o diagnostiku a servis.",
    userName: "Eva Bartošová",
    phone: "+421 903 444 555",
  }),
  withRequestDefaults({
    id: "5",
    status: "inquiry",
    requestCategory: "auto",
    vehicleName: "Audi A4",
    vehicleTitle: "Audi A4 2.0 TDI",
    service: "Kontrola bŕzd",
    licensePlate: "KI111XX",
    distanceKm: 45.3,
    locationCity: "Kysucké Nové Mesto",
    vin: "WAUZZZ8K9KA123456",
    engineVolume: "2.0 l",
    power: "110 kW",
    fuelType: "Diesel",
    year: 2015,
    engine: "2.0 TDI",
    drive: "FWD",
    bodyType: "Sedan",
    doors: 4,
    mileageKm: 198400,
    transmission: "Manuálna",
    inquiryDescription:
      "Pri brzdení cítim vibrácie, prosím o kontrolu kotúčov a doštičiek.",
    userName: "Tomáš Varga",
    phone: "+421 907 111 222",
  }),
  withRequestDefaults({
    id: "6",
    status: "inquiry",
    requestCategory: "auto",
    vehicleName: "Toyota Corolla",
    vehicleTitle: "Toyota Corolla 1.8 Hybrid",
    service: "Servis hybridného systému",
    licensePlate: "ZA456CD",
    distanceKm: 22.8,
    locationCity: "Rajec",
    vin: "JTNKARJE0J1234567",
    engineVolume: "1.8 l",
    power: "90 kW",
    fuelType: "Hybrid",
    year: 2019,
    engine: "1.8 Hybrid",
    drive: "FWD",
    bodyType: "Hatchback",
    doors: 5,
    mileageKm: 75600,
    transmission: "Automatická",
    inquiryDescription:
      "Bliká kontrolka hybridného systému, potrebujem diagnostiku.",
    userName: "Lucia Poláková",
    phone: "+421 918 333 444",
  }),
  withRequestDefaults({
    id: "7",
    status: "inquiry",
    requestCategory: "auto",
    vehicleName: "Peugeot 308",
    vehicleTitle: "Peugeot 308 1.6 HDI",
    service: "Výmena rozvodov",
    licensePlate: "NO789GH",
    distanceKm: 68.9,
    locationCity: "Námestovo",
    vin: "VF3LB9HXBFS123456",
    engineVolume: "1.6 l",
    power: "68 kW",
    fuelType: "Diesel",
    year: 2011,
    engine: "1.6 HDI",
    drive: "FWD",
    bodyType: "Combi",
    doors: 5,
    mileageKm: 231500,
    transmission: "Manuálna",
    inquiryDescription:
      "Po studenom štarte počujem rattle, chcem skontrolovať rozvody.",
    userName: "Michal Kollár",
    phone: "+421 949 555 666",
  }),
  withRequestDefaults({
    id: "8",
    status: "inquiry",
    requestCategory: "auto",
    vehicleName: "Honda Civic",
    vehicleTitle: "Honda Civic 1.5 VTEC Turbo",
    service: "Geometria kolies",
    licensePlate: "ZA852MK",
    distanceKm: 11.2,
    locationCity: "Teplička nad Váhom",
    vin: "SHHFK1760HU123456",
    engineVolume: "1.5 l",
    power: "134 kW",
    fuelType: "Benzín",
    year: 2020,
    engine: "1.5 VTEC Turbo",
    drive: "FWD",
    bodyType: "Hatchback",
    doors: 5,
    mileageKm: 62400,
    transmission: "Manuálna",
    inquiryDescription:
      "Auto ťahá doprava, potrebujem nastaviť geometriu a skontrolovať pneumatiky.",
    userName: "Kristína Hudáková",
    phone: "+421 910 222 118",
  }),
  withRequestDefaults({
    id: "9",
    status: "inquiry",
    requestCategory: "auto",
    vehicleName: "Mercedes-Benz C 220",
    vehicleTitle: "Mercedes-Benz C 220 d",
    service: "Servis AdBlue",
    licensePlate: "TN334RS",
    distanceKm: 96.4,
    locationCity: "Liptovský Mikuláš",
    vin: "WDD2050141A123456",
    engineVolume: "2.0 l",
    power: "125 kW",
    fuelType: "Diesel",
    year: 2017,
    engine: "2.0 d",
    drive: "RWD",
    bodyType: "Sedan",
    doors: 4,
    mileageKm: 118900,
    transmission: "Automatická",
    inquiryDescription:
      "Svieti kontrolka AdBlue, prosím o doplnenie a kontrolu systému.",
    userName: "Roman Slanina",
    phone: "+421 905 778 901",
  }),
  withRequestDefaults({
    id: "10",
    status: "inquiry",
    requestCategory: "auto",
    vehicleName: "Suzuki Vitara",
    vehicleTitle: "Suzuki Vitara 1.4 Boosterjet",
    service: "Výmena oleja a filtrov",
    licensePlate: "NO445TU",
    distanceKm: 54.1,
    locationCity: "Tvrdošín",
    vin: "TSMLYEA1S00123456",
    engineVolume: "1.4 l",
    power: "103 kW",
    fuelType: "Benzín",
    year: 2021,
    engine: "1.4 Boosterjet",
    drive: "4x4",
    bodyType: "SUV",
    doors: 5,
    mileageKm: 38700,
    transmission: "Automatická",
    inquiryDescription:
      "Blíži sa servisná prehliadka, chcem výmenu oleja, filtra oleja a vzduchu.",
    userName: "Zuzana Oravcová",
    phone: "+421 917 654 321",
  }),
  withRequestDefaults({
    id: "11",
    status: "inquiry",
    requestCategory: "auto",
    vehicleName: "Opel Astra",
    vehicleTitle: "Opel Astra 1.6 CDTI",
    service: "Diagnostika DPF",
    licensePlate: "KI992OP",
    distanceKm: 31.6,
    locationCity: "Čadca",
    vin: "W0LBF5D99G1234567",
    engineVolume: "1.6 l",
    power: "81 kW",
    fuelType: "Diesel",
    year: 2014,
    engine: "1.6 CDTI",
    drive: "FWD",
    bodyType: "Combi",
    doors: 5,
    mileageKm: 167800,
    transmission: "Manuálna",
    inquiryDescription:
      "Auto ide do regenerácie príliš často, chcem skontrolovať DPF a snímače.",
    userName: "Filip Gašpar",
    phone: "+421 944 112 887",
  }),
  withRequestDefaults({
    id: "12",
    status: "inquiry",
    requestCategory: "auto",
    vehicleName: "Mazda 3",
    vehicleTitle: "Mazda 3 2.0 Skyactiv-G",
    service: "Kontrola podvozku",
    licensePlate: "ZA771MZ",
    distanceKm: 17.9,
    locationCity: "Rosina",
    vin: "JM1BPACM1K1234567",
    engineVolume: "2.0 l",
    power: "90 kW",
    fuelType: "Benzín",
    year: 2018,
    engine: "2.0 Skyactiv-G",
    drive: "FWD",
    bodyType: "Hatchback",
    doors: 5,
    mileageKm: 91200,
    transmission: "Manuálna",
    inquiryDescription:
      "Po prejazde nerovnosťou počujem klepanie vpredu, prosím o kontrolu silentblokov.",
    userName: "Andrea Križanová",
    phone: "+421 908 445 776",
  }),
  withRequestDefaults({
    id: "13",
    status: "inquiry",
    requestCategory: "auto",
    vehicleCategory: "van",
    vehicleName: "Ford Transit",
    vehicleTitle: "Ford Transit 2.0 TDCi",
    service: "Výmena oleja a filtrov",
    licensePlate: "ZA331DT",
    distanceKm: 19.4,
    locationCity: "Žilina",
    vin: "WF0XXXTTGX1234567",
    engineVolume: "2.0 l",
    power: "96 kW",
    fuelType: "Diesel",
    year: 2018,
    engine: "2.0 TDCi",
    drive: "FWD",
    bodyType: "Dodávka",
    doors: 4,
    mileageKm: 214800,
    transmission: "Manuálna",
    inquiryDescription:
      "Potrebujem servisnú výmenu oleja a filtrov pred dlhšou trasou po Slovensku.",
    userName: "Martin Ďurica",
    phone: "+421 910 441 220",
  }),
  withRequestDefaults({
    id: "14",
    status: "inquiry",
    requestCategory: "auto",
    vehicleCategory: "van",
    vehicleName: "Mercedes Sprinter",
    vehicleTitle: "Mercedes Sprinter 316 CDI",
    service: "Kontrola bŕzd",
    licensePlate: "NO552SP",
    distanceKm: 37.2,
    locationCity: "Dolný Kubín",
    vin: "WDB9066331S123456",
    engineVolume: "2.1 l",
    power: "120 kW",
    fuelType: "Diesel",
    year: 2016,
    engine: "316 CDI",
    drive: "RWD",
    bodyType: "Dodávka",
    doors: 4,
    mileageKm: 289400,
    transmission: "Manuálna",
    inquiryDescription:
      "Pri plnom zaťažení cítim slabšie brzdenie, prosím o kontrolu brzdového systému.",
    userName: "Jozef Kmeť",
    phone: "+421 949 881 334",
  }),
  withRequestDefaults({
    id: "15",
    status: "done",
    requestCategory: "auto",
    vehicleCategory: "van",
    vehicleName: "VW Crafter",
    vehicleTitle: "VW Crafter 2.0 TDI",
    service: "Diagnostika motora",
    licensePlate: "KI778VC",
    distanceKm: 26.5,
    locationCity: "Bytča",
    vin: "WV1ZZZ2KZJX123456",
    engineVolume: "2.0 l",
    power: "103 kW",
    fuelType: "Diesel",
    year: 2019,
    engine: "2.0 TDI",
    drive: "FWD",
    bodyType: "Dodávka",
    doors: 4,
    mileageKm: 156700,
    transmission: "Automatická",
    inquiryDescription:
      "Občas sa rozsvieti kontrolka motora, auto občas prepne do núdzového režimu.",
    userName: "Silvia Hrušková",
    phone: "+421 918 772 119",
  }),
  withRequestDefaults({
    id: "16",
    status: "inquiry",
    requestCategory: "auto",
    vehicleCategory: "van",
    vehicleName: "Renault Master",
    vehicleTitle: "Renault Master 2.3 dCi",
    service: "Servis klimatizácie",
    licensePlate: "TN904RM",
    distanceKm: 58.7,
    locationCity: "Ružomberok",
    vin: "VF1MA0000H1234567",
    engineVolume: "2.3 l",
    power: "96 kW",
    fuelType: "Diesel",
    year: 2017,
    engine: "2.3 dCi",
    drive: "FWD",
    bodyType: "Dodávka",
    doors: 4,
    mileageKm: 241300,
    transmission: "Manuálna",
    inquiryDescription:
      "Klimatizácia nefúka dostatočne studený vzduch, prosím o kontrolu a doplnenie chladiva.",
    userName: "Dušan Poliak",
    phone: "+421 905 663 778",
  }),
  withRequestDefaults({
    id: "17",
    status: "inquiry",
    requestCategory: "tire",
    vehicleName: "Hyundai i30",
    vehicleTitle: "Hyundai i30 1.6 CRDi",
    service: "Výmena letných pneumatík",
    licensePlate: "ZA552TP",
    distanceKm: 11.3,
    locationCity: "Žilina",
    vin: "TMAH251CAL1234567",
    engineVolume: "1.6 l",
    power: "81 kW",
    fuelType: "Diesel",
    year: 2018,
    engine: "1.6 CRDi",
    drive: "FWD",
    bodyType: "Hatchback",
    doors: 5,
    mileageKm: 118400,
    transmission: "Manuálna",
    inquiryDescription:
      "Potrebujem prehodiť zimné na letné pneumatiky vrátane vyváženia kolies.",
    userName: "Lucia Bartošová",
    phone: "+421 907 441 220",
  }),
  withRequestDefaults({
    id: "18",
    status: "inquiry",
    requestCategory: "towing",
    vehicleName: "Opel Astra",
    vehicleTitle: "Opel Astra 1.4 Turbo",
    service: "Odťah vozidla",
    licensePlate: "BL118OD",
    distanceKm: 34.2,
    locationCity: "Martin",
    vin: "W0LPD6ECXG1234567",
    engineVolume: "1.4 l",
    power: "103 kW",
    fuelType: "Benzín",
    year: 2015,
    engine: "1.4 Turbo",
    drive: "FWD",
    bodyType: "Combi",
    doors: 5,
    mileageKm: 167800,
    transmission: "Manuálna",
    inquiryDescription:
      "Vozidlo neštartuje po nehode, potrebujem odťah do servisu v Martine.",
    userName: "Tomáš Vlk",
    phone: "+421 944 118 900",
  }),
  withRequestDefaults({
    id: "19",
    status: "inquiry",
    requestCategory: "tire",
    vehicleName: "Kia Ceed",
    vehicleTitle: "Kia Ceed 1.0 T-GDI",
    service: "Prezutie a vyváženie",
    licensePlate: "ZA901PN",
    distanceKm: 6.8,
    locationCity: "Bytča",
    vin: "U5YH3511AKL123456",
    engineVolume: "1.0 l",
    power: "74 kW",
    fuelType: "Benzín",
    year: 2020,
    engine: "1.0 T-GDI",
    drive: "FWD",
    bodyType: "Hatchback",
    doors: 5,
    mileageKm: 54200,
    transmission: "Manuálna",
    inquiryDescription:
      "Mám vlastné pneumatiky, potrebujem len prezutie a vyváženie všetkých kolies.",
    userName: "Erik Baláž",
    phone: "+421 911 220 331",
  }),
  withRequestDefaults({
    id: "20",
    status: "inquiry",
    requestCategory: "tire",
    vehicleName: "Volkswagen Passat",
    vehicleTitle: "VW Passat 2.0 TDI",
    service: "Uskladnenie pneumatík + prezutie",
    licensePlate: "KI220PN",
    distanceKm: 14.6,
    locationCity: "Rajec",
    vin: "WVWZZZ3CZJE123456",
    engineVolume: "2.0 l",
    power: "110 kW",
    fuelType: "Diesel",
    year: 2017,
    engine: "2.0 TDI",
    drive: "FWD",
    bodyType: "Combi",
    doors: 5,
    mileageKm: 198300,
    transmission: "Automatická",
    inquiryDescription:
      "Prezutie na zimné, staré uskladniť u vás do jari.",
    userName: "Jana Šimková",
    phone: "+421 948 771 002",
  }),
  withRequestDefaults({
    id: "21",
    status: "inquiry",
    requestCategory: "towing",
    vehicleName: "Škoda Fabia",
    vehicleTitle: "Škoda Fabia 1.2 HTP",
    service: "Odťahová služba",
    licensePlate: "ZA881OT",
    distanceKm: 4.2,
    locationCity: "Bytča",
    vin: "TMBBS25J203123456",
    engineVolume: "1.2 l",
    power: "47 kW",
    fuelType: "Benzín",
    year: 2008,
    engine: "1.2 HTP",
    drive: "FWD",
    bodyType: "Hatchback",
    doors: 5,
    mileageKm: 201400,
    transmission: "Manuálna",
    inquiryDescription:
      "Auto zostalo na križovatke, nejazdí. Potrebujem odťah do servisu v Bytči.",
    userName: "Marek Ondruš",
    phone: "+421 905 118 440",
  }),
  withRequestDefaults({
    id: "22",
    status: "inquiry",
    requestCategory: "towing",
    vehicleName: "BMW X3",
    vehicleTitle: "BMW X3 xDrive20d",
    service: "Odťah po poruche",
    licensePlate: "ZA334OT",
    distanceKm: 12.5,
    locationCity: "Žilina",
    vin: "WBAWZ5C50DD123456",
    engineVolume: "2.0 l",
    power: "140 kW",
    fuelType: "Diesel",
    year: 2016,
    engine: "2.0 d",
    drive: "4x4",
    bodyType: "SUV",
    doors: 5,
    mileageKm: 142600,
    transmission: "Automatická",
    inquiryDescription:
      "Zhasol motor na diaľnici pri Žiline, vozidlo je mimo cesty. Prosím o odťah.",
    userName: "Iveta Krajčírová",
    phone: "+421 918 660 118",
  }),
  withRequestDefaults({
    id: "23",
    status: "inquiry",
    requestCategory: "towing",
    vehicleName: "Ford Ranger",
    vehicleTitle: "Ford Ranger 2.2 TDCi",
    service: "Odťah pick-upu",
    licensePlate: "NO559OT",
    distanceKm: 28.4,
    locationCity: "Čadca",
    vin: "WF0FXXTACF1234567",
    engineVolume: "2.2 l",
    power: "92 kW",
    fuelType: "Diesel",
    year: 2014,
    engine: "2.2 TDCi",
    drive: "4x4",
    bodyType: "Pick-up",
    doors: 4,
    mileageKm: 256900,
    transmission: "Manuálna",
    inquiryDescription:
      "Poškodený predok po zrážke, auto nejazdí. Odťah do najbližšieho servisu.",
    userName: "Róbert Jančo",
    phone: "+421 944 902 771",
  }),
];

export function subscribeToRequestChanges(onChange: () => void) {
  const channel = supabase
    .channel("requests-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "requests" },
      () => {
        onChange();
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
