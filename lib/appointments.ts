import { supabase } from "./supabase";
import {
  clearRequestRescheduleRequested,
  formatHistoryDateLabel,
  setRequestRescheduleRequested,
  toHistoryDateKey,
  updateRequestStatus,
  upsertRequest,
  type Request,
} from "./requests";

export type AppointmentStatus = "pending" | "accepted" | "rejected";

export type Appointment = {
  id: string;
  request_id?: string | null;
  customer_name: string;
  vehicle_info: string;
  appointment_date: string;
  appointment_time: string;
  status: AppointmentStatus;
  message?: string | null;
  reschedule_requested_at?: string | null;
  created_at?: string;
};

export type AppointmentProposalKind = "initial" | "counter";

export type AppointmentProposal = {
  id: string;
  request_id: string;
  appointment_date: string;
  appointment_time: string;
  message?: string | null;
  sent_at: string;
  proposal_kind: AppointmentProposalKind;
};

const APPOINTMENT_PROPOSAL_SELECT_FIELDS =
  "id, request_id, appointment_date, appointment_time, message, sent_at, proposal_kind";

const APPOINTMENT_SELECT_FIELDS =
  "id, request_id, customer_name, vehicle_info, appointment_date, appointment_time, status, message, reschedule_requested_at, created_at";

const APPOINTMENT_SELECT_FIELDS_LEGACY =
  "id, request_id, customer_name, vehicle_info, appointment_date, appointment_time, status, message, created_at";

export function hasRescheduleRequest(appointment: Appointment | null | undefined) {
  return Boolean(appointment?.reschedule_requested_at);
}

export async function requestCustomerReschedule(requestId: string) {
  return setRequestRescheduleRequested(requestId);
}

export type RequestLike = {
  id: string;
  status: string;
  userName: string;
  vehicleName: string;
  engine: string;
  power: string;
  year: number;
  licensePlate: string;
};

export function formatVehicleInfo(
  request: Pick<RequestLike, "vehicleName" | "year" | "licensePlate">,
) {
  return `${request.vehicleName} ${request.year} - EC-${request.licensePlate}`;
}

export function formatAppointmentLabel(appointment: Appointment) {
  return appointment.vehicle_info;
}

export function formatCalendarPowerLabel(power: string) {
  const trimmed = power.trim();
  if (!trimmed) return "";

  const number = trimmed.replace(/\s*kW\s*/gi, "").trim();
  if (!number) return trimmed;

  return `${number} KW`;
}

export function formatCalendarAppointmentLabel(
  appointment: Appointment,
  request: Pick<RequestLike, "vehicleName" | "engine" | "power" | "year"> | null,
) {
  if (!request) return appointment.vehicle_info;

  return [
    request.vehicleName,
    request.engine,
    formatCalendarPowerLabel(request.power),
    String(request.year),
  ].join(", ");
}

export function appointmentDateTime(appointment: Appointment) {
  const [hours, minutes] = appointment.appointment_time.split(":").map(Number);
  const date = new Date(`${appointment.appointment_date}T00:00:00`);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

export function findRequestForAppointment<T extends RequestLike>(
  appointment: Appointment,
  requests: T[],
): T | null {
  if (appointment.request_id) {
    const linkedRequest = requests.find((request) => request.id === appointment.request_id);
    if (linkedRequest) return linkedRequest;
  }

  return (
    requests.find(
      (request) =>
        request.userName === appointment.customer_name &&
        formatVehicleInfo(request) === appointment.vehicle_info,
    ) ?? null
  );
}

export function filterAppointmentsForCalendar(
  appointments: Appointment[],
  requests: RequestLike[],
) {
  return appointments.filter((appointment) => {
    const matchedRequest = findRequestForAppointment(appointment, requests);
    return (
      matchedRequest !== null &&
      matchedRequest.status !== "completed" &&
      matchedRequest.status !== "cancelled" &&
      matchedRequest.status !== "expired" &&
      (matchedRequest.status === "inquiry" ||
        matchedRequest.status === "waiting" ||
        matchedRequest.status === "done")
    );
  });
}

export function buildCalendarAppointments(
  acceptedAppointments: Appointment[],
  pendingAppointments: Appointment[],
  requests: RequestLike[],
) {
  const calendarAccepted = filterAppointmentsForCalendar(
    acceptedAppointments,
    requests,
  );
  const linkedRequestIds = new Set(
    calendarAccepted
      .map((appointment) => findRequestForAppointment(appointment, requests)?.id)
      .filter((requestId): requestId is string => Boolean(requestId)),
  );

  const pendingForDone = pendingAppointments.filter((appointment) => {
    if (!appointment.request_id || linkedRequestIds.has(appointment.request_id)) {
      return false;
    }

    const request = requests.find((entry) => entry.id === appointment.request_id);
    return request?.status === "done";
  });

  return [...calendarAccepted, ...pendingForDone].sort((left, right) => {
    const dateCompare = left.appointment_date.localeCompare(right.appointment_date);
    if (dateCompare !== 0) return dateCompare;
    return left.appointment_time.localeCompare(right.appointment_time);
  });
}

export function formatAppointmentDisplayDate(date: string) {
  return formatHistoryDateLabel(date);
}

export function formatAppointmentDisplayTime(time: string) {
  return time.slice(0, 5);
}

export function formatAppointmentSchedule(appointment: Appointment) {
  return `${formatAppointmentDisplayDate(appointment.appointment_date)} · ${formatAppointmentDisplayTime(appointment.appointment_time)}`;
}

export function formatProposalSchedule(
  proposal: Pick<AppointmentProposal, "appointment_date" | "appointment_time">,
) {
  return `${formatAppointmentDisplayDate(proposal.appointment_date)} · ${formatAppointmentDisplayTime(proposal.appointment_time)}`;
}

export function formatProposalSentAt(sentAt: string) {
  const parsed = new Date(sentAt);
  if (Number.isNaN(parsed.getTime())) return sentAt;

  const datePart = formatHistoryDateLabel(toHistoryDateKey(sentAt));
  const timePart = `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;

  return `${datePart}, ${timePart}`;
}

export function buildProposalMap(proposals: AppointmentProposal[]) {
  const map = new Map<string, AppointmentProposal[]>();

  for (const proposal of proposals) {
    const current = map.get(proposal.request_id) ?? [];
    current.push(proposal);
    map.set(proposal.request_id, current);
  }

  for (const [requestId, items] of map) {
    map.set(
      requestId,
      [...items].sort((left, right) => left.sent_at.localeCompare(right.sent_at)),
    );
  }

  return map;
}

export function buildInquiryProposalTimeline(
  proposals: AppointmentProposal[],
  pendingAppointment: Appointment | null,
): AppointmentProposal[] {
  if (proposals.length > 0) return proposals;
  if (!pendingAppointment) return [];

  return [
    {
      id: `pending-${pendingAppointment.id}`,
      request_id: pendingAppointment.request_id ?? "",
      appointment_date: pendingAppointment.appointment_date,
      appointment_time: pendingAppointment.appointment_time,
      message: pendingAppointment.message,
      sent_at: pendingAppointment.created_at ?? new Date().toISOString(),
      proposal_kind: "initial",
    },
  ];
}

export async function fetchAppointmentProposals() {
  const { data, error } = await supabase
    .from("appointment_proposals")
    .select(APPOINTMENT_PROPOSAL_SELECT_FIELDS)
    .order("sent_at", { ascending: true });

  if (error) {
    if (error.code === "PGRST205" || error.code === "PGRST204") return [];
    throw error;
  }

  return (data ?? []) as AppointmentProposal[];
}

async function recordAppointmentProposal(input: {
  requestId: string;
  appointmentDate: string;
  appointmentTime: string;
  message: string;
  kind: AppointmentProposalKind;
}) {
  const sentAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("appointment_proposals")
    .insert({
      request_id: input.requestId,
      appointment_date: input.appointmentDate,
      appointment_time: normalizeAppointmentTime(input.appointmentTime),
      message: input.message.trim() || null,
      sent_at: sentAt,
      proposal_kind: input.kind,
    })
    .select(APPOINTMENT_PROPOSAL_SELECT_FIELDS)
    .maybeSingle();

  if (error) {
    if (error.code === "42501" || error.message?.includes("row-level security")) {
      throw new Error(
        "Chýba oprávnenie pre appointment_proposals. Spustite supabase/fix-casker-db-permissions.sql v Supabase.",
      );
    }
    if (error.code === "PGRST204" || error.code === "PGRST205") {
      throw new Error(
        "Chýba tabuľka appointment_proposals. Spustite migráciu supabase/appointment-proposals.sql.",
      );
    }
    throw error;
  }

  if (!data) {
    throw new Error("Návrh termínu sa nepodarilo zaznamenať.");
  }

  return data as AppointmentProposal;
}

export function buildAppointmentMapByRequestId(
  appointments: Appointment[],
  requests: RequestLike[],
) {
  const map = new Map<string, Appointment>();

  for (const appointment of appointments) {
    if (appointment.request_id && !map.has(appointment.request_id)) {
      map.set(appointment.request_id, appointment);
      continue;
    }

    const matchedRequest = findRequestForAppointment(appointment, requests);
    if (matchedRequest && !map.has(matchedRequest.id)) {
      map.set(matchedRequest.id, appointment);
    }
  }

  return map;
}

export function buildPendingAppointmentMap(
  appointments: Appointment[],
  requests: RequestLike[],
) {
  const map = new Map<string, Appointment>();
  const mergedAppointments = [...appointments];

  for (const demoAppointment of DEMO_PENDING_APPOINTMENTS) {
    const alreadyLinked = mergedAppointments.some(
      (appointment) => appointment.request_id === demoAppointment.request_id,
    );
    if (!alreadyLinked) {
      mergedAppointments.push(demoAppointment);
    }
  }

  return buildAppointmentMapByRequestId(mergedAppointments, requests);
}

export function mergeDemoAcceptedAppointments(appointments: Appointment[]) {
  const mergedAppointments = [...appointments];

  for (const demoAppointment of DEMO_ACCEPTED_APPOINTMENTS) {
    const alreadyLinked = mergedAppointments.some(
      (appointment) => appointment.request_id === demoAppointment.request_id,
    );
    if (!alreadyLinked) {
      mergedAppointments.push(demoAppointment);
    }
  }

  return mergedAppointments;
}

export function buildAcceptedAppointmentMap(
  appointments: Appointment[],
  requests: RequestLike[],
) {
  const mergedAppointments = mergeDemoAcceptedAppointments(appointments);

  return buildAppointmentMapByRequestId(mergedAppointments, requests);
}

export const DEMO_PENDING_APPOINTMENTS: Appointment[] = [
  {
    id: "demo-pending-2",
    request_id: "2",
    customer_name: "Mária Kováčová",
    vehicle_info: "VW Golf 2016 - EC-ZA123AB",
    appointment_date: "2026-05-27",
    appointment_time: "09:30:00",
    status: "pending",
    message:
      "Navrhujeme diagnostiku motora dňa 27.5. o 9:30. Prosím o potvrdenie termínu.",
  },
];

export const DEMO_ACCEPTED_APPOINTMENTS: Appointment[] = [
  {
    id: "demo-accepted-3",
    request_id: "3",
    customer_name: "Peter Horváth",
    vehicle_info: "Ford Focus 2012 - EC-BL456CD",
    appointment_date: "2026-05-28",
    appointment_time: "10:00:00",
    status: "accepted",
    message: "Výmena brzdových doštičiek je naplánovaná na 28.5. o 10:00.",
  },
  {
    id: "demo-accepted-15",
    request_id: "15",
    customer_name: "Silvia Hrušková",
    vehicle_info: "VW Crafter 2019 - EC-KI778VC",
    appointment_date: "2026-05-30",
    appointment_time: "08:00:00",
    status: "accepted",
    message: "Diagnostika motora je potvrdená na 30.5. o 8:00.",
  },
];

export async function createPendingAppointment(input: {
  request: Request;
  appointmentDate: string;
  appointmentTime: string;
  message: string;
}) {
  const validationError = getAppointmentDateTimeValidationError(
    input.appointmentDate,
    input.appointmentTime,
  );
  if (validationError) {
    throw new Error(validationError);
  }

  await upsertRequest(input.request);

  const appointmentPayload = {
    request_id: input.request.id,
    customer_name: input.request.userName,
    vehicle_info: formatVehicleInfo(input.request),
    appointment_date: input.appointmentDate,
    appointment_time: normalizeAppointmentTime(input.appointmentTime),
    message: input.message.trim(),
    status: "pending" as const,
  };

  let { error } = await supabase.from("appointments").insert(appointmentPayload);

  if (error?.code === "PGRST204") {
    const { request_id: _requestId, message: _message, ...legacyPayload } =
      appointmentPayload;
    ({ error } = await supabase.from("appointments").insert(legacyPayload));
  }

  if (error) throw error;

  await recordAppointmentProposal({
    requestId: input.request.id,
    appointmentDate: input.appointmentDate,
    appointmentTime: input.appointmentTime,
    message: input.message,
    kind: "initial",
  });

  try {
    await updateRequestStatus(input.request.id, "waiting");
    await clearRequestRescheduleRequested(input.request.id);
  } catch (updateError) {
    console.warn("Stav dopytu sa nepodarilo uložiť do DB:", updateError);
  }
}

export async function rescheduleAppointment(input: {
  request: Request;
  appointmentDate: string;
  appointmentTime: string;
  message: string;
}) {
  const validationError = getAppointmentDateTimeValidationError(
    input.appointmentDate,
    input.appointmentTime,
  );
  if (validationError) {
    throw new Error(validationError);
  }

  await upsertRequest(input.request);

  const appointmentPayload = {
    request_id: input.request.id,
    customer_name: input.request.userName,
    vehicle_info: formatVehicleInfo(input.request),
    appointment_date: input.appointmentDate,
    appointment_time: normalizeAppointmentTime(input.appointmentTime),
    message: input.message.trim(),
    status: "pending" as const,
  };

  const { data: existingRows, error: findError } = await supabase
    .from("appointments")
    .select("id")
    .eq("request_id", input.request.id)
    .in("status", ["accepted", "pending"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (findError) throw findError;

  const existing = existingRows?.[0];

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("appointments")
      .update({
        ...appointmentPayload,
        reschedule_requested_at: null,
      })
      .eq("id", existing.id);

    if (updateError) {
      if (updateError.code === "PGRST204") {
        const { error: legacyUpdateError } = await supabase
          .from("appointments")
          .update(appointmentPayload)
          .eq("id", existing.id);
        if (legacyUpdateError) throw legacyUpdateError;
      } else {
        throw updateError;
      }
    }
  } else {
    const { error: insertError } = await supabase
      .from("appointments")
      .insert(appointmentPayload);

    if (insertError) throw insertError;
  }

  await recordAppointmentProposal({
    requestId: input.request.id,
    appointmentDate: input.appointmentDate,
    appointmentTime: input.appointmentTime,
    message: input.message,
    kind: existing?.id ? "counter" : "initial",
  });

  await updateRequestStatus(input.request.id, "waiting");
  await clearRequestRescheduleRequested(input.request.id);
}

export async function syncAcceptedRequestStatuses() {
  const { data: acceptedAppointments, error } = await supabase
    .from("appointments")
    .select("request_id, customer_name, vehicle_info")
    .eq("status", "accepted");

  if (error) {
    if (error.code === "PGRST205" || error.code === "PGRST204") return;
    throw error;
  }

  if (!acceptedAppointments || acceptedAppointments.length === 0) return;

  const { data: requestRows, error: requestsError } = await supabase
    .from("requests")
    .select("id, status, user_name, vehicle_name, year, license_plate");

  if (requestsError) {
    if (requestsError.code === "PGRST205") return;
    throw requestsError;
  }

  const requestIds = new Set<string>();

  for (const appointment of acceptedAppointments) {
    if (appointment.request_id) {
      const linkedRequest = (requestRows ?? []).find(
        (request) => request.id === appointment.request_id,
      );
      if (
        linkedRequest &&
        (linkedRequest.status === "inquiry" || linkedRequest.status === "waiting")
      ) {
        requestIds.add(appointment.request_id);
      }
      continue;
    }

    const matchedRequest = (requestRows ?? []).find((request) => {
      const vehicleInfo = `${request.vehicle_name} ${request.year} - EC-${request.license_plate}`;
      return (
        request.user_name === appointment.customer_name &&
        vehicleInfo === appointment.vehicle_info
      );
    });

    if (
      matchedRequest?.id &&
      (matchedRequest.status === "inquiry" || matchedRequest.status === "waiting")
    ) {
      requestIds.add(matchedRequest.id);
    }
  }

  if (requestIds.size === 0) return;

  const { error: updateError } = await supabase
    .from("requests")
    .update({ status: "done", updated_at: new Date().toISOString() })
    .in("id", [...requestIds])
    .in("status", ["inquiry", "waiting"]);

  if (updateError) throw updateError;
}

export async function fetchAcceptedAppointments() {
  const { data, error } = await supabase
    .from("appointments")
    .select(APPOINTMENT_SELECT_FIELDS)
    .eq("status", "accepted");

  if (error?.code === "PGRST204") {
    const fallback = await supabase
      .from("appointments")
      .select(APPOINTMENT_SELECT_FIELDS_LEGACY)
      .eq("status", "accepted");
    if (fallback.error) throw fallback.error;
    return ([...(fallback.data ?? [])] as Appointment[]).sort((left, right) => {
      const dateCompare = left.appointment_date.localeCompare(right.appointment_date);
      if (dateCompare !== 0) return dateCompare;
      return left.appointment_time.localeCompare(right.appointment_time);
    });
  }

  if (error) throw error;

  return ([...(data ?? [])] as Appointment[]).sort((left, right) => {
    const dateCompare = left.appointment_date.localeCompare(right.appointment_date);
    if (dateCompare !== 0) return dateCompare;
    return left.appointment_time.localeCompare(right.appointment_time);
  });
}

export async function fetchPendingAppointments() {
  const { data, error } = await supabase
    .from("appointments")
    .select(APPOINTMENT_SELECT_FIELDS)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error?.code === "PGRST204") {
    const fallback = await supabase
      .from("appointments")
      .select(APPOINTMENT_SELECT_FIELDS_LEGACY)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []) as Appointment[];
  }

  if (error) throw error;

  return (data ?? []) as Appointment[];
}

export function subscribeToAppointmentChanges(onChange: () => void) {
  const channel = supabase
    .channel("appointments-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "appointments" },
      () => {
        onChange();
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseBookingTimeInput(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function buildAppointmentDateTime(appointmentDate: string, appointmentTime: string) {
  const parsedTime = parseBookingTimeInput(appointmentTime);
  if (!parsedTime) return null;

  const [year, month, day] = appointmentDate.split("-").map(Number);
  const [hours, minutes] = parsedTime.split(":").map(Number);
  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export function isAppointmentDateTimeInPast(
  appointmentDate: string,
  appointmentTime: string,
  now = new Date(),
) {
  const appointmentAt = buildAppointmentDateTime(appointmentDate, appointmentTime);
  if (!appointmentAt) return false;

  return appointmentAt.getTime() <= now.getTime();
}

export function getAppointmentDateTimeValidationError(
  appointmentDate: string,
  appointmentTime: string,
  now = new Date(),
) {
  if (!parseBookingTimeInput(appointmentTime)) {
    return "Zadajte platný čas vo formáte HH:MM (napr. 8:30 alebo 14:15).";
  }

  if (isAppointmentDateTimeInPast(appointmentDate, appointmentTime, now)) {
    return "Neplatné údaje";
  }

  return null;
}

export function normalizeAppointmentTime(time: string) {
  const parsed = parseBookingTimeInput(time);
  if (parsed) return `${parsed}:00`;

  const [hours = "0", minutes = "0"] = time.split(":");
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:00`;
}

export function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function isSameDay(a: Date, b: Date) {
  return toDateKey(a) === toDateKey(b);
}

export const CALENDAR_DAY_START_HOUR = 7;
export const CALENDAR_DAY_END_HOUR = 19;
export const CALENDAR_HOUR_HEIGHT_REM = 3.25;

export function parseAppointmentTimeMinutes(time: string) {
  const [hours = "0", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

export function getCalendarHourLabels(
  startHour = CALENDAR_DAY_START_HOUR,
  endHour = CALENDAR_DAY_END_HOUR,
) {
  return Array.from({ length: endHour - startHour }, (_, index) => startHour + index);
}

export function getCalendarTrackHeightRem(
  startHour = CALENDAR_DAY_START_HOUR,
  endHour = CALENDAR_DAY_END_HOUR,
  hourHeightRem = CALENDAR_HOUR_HEIGHT_REM,
) {
  return (endHour - startHour) * hourHeightRem;
}

export function getCalendarAppointmentTopRem(
  time: string,
  startHour = CALENDAR_DAY_START_HOUR,
  hourHeightRem = CALENDAR_HOUR_HEIGHT_REM,
) {
  const offsetMinutes = parseAppointmentTimeMinutes(time) - startHour * 60;
  const clampedMinutes = Math.max(0, offsetMinutes);
  return (clampedMinutes / 60) * hourHeightRem;
}

export function formatCalendarHourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}
