import type { DriverRequestSummary } from "@/lib/driver-requests-api";

export type DriverCalendarEntry = {
  id: string;
  requestId: string;
  vehicleLabel: string;
  licensePlate: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
};

export const CALENDAR_DAY_START_HOUR = 5;
/** Exclusive end — hour labels run 05:00 … 20:00 */
export const CALENDAR_DAY_END_HOUR = 21;
export const CALENDAR_HOUR_HEIGHT = 52;

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

export function isSameDay(left: Date, right: Date) {
  return toDateKey(left) === toDateKey(right);
}

export function getCalendarHourLabels(
  startHour = CALENDAR_DAY_START_HOUR,
  endHour = CALENDAR_DAY_END_HOUR,
) {
  const hourCount = Math.max(0, endHour - startHour);
  return Array.from({ length: hourCount }, (_, index) => startHour + index);
}

export function getCalendarTrackHeight(
  startHour = CALENDAR_DAY_START_HOUR,
  endHour = CALENDAR_DAY_END_HOUR,
  hourHeight = CALENDAR_HOUR_HEIGHT,
) {
  return (endHour - startHour) * hourHeight;
}

function parseAppointmentTimeMinutes(time: string) {
  const [hours = "0", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

export function getCalendarAppointmentTop(
  time: string,
  startHour = CALENDAR_DAY_START_HOUR,
  hourHeight = CALENDAR_HOUR_HEIGHT,
) {
  const offsetMinutes = parseAppointmentTimeMinutes(time) - startHour * 60;
  const clampedMinutes = Math.max(0, offsetMinutes);
  return (clampedMinutes / 60) * hourHeight;
}

export function formatCalendarHourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function formatCalendarHeaderDate(date: Date) {
  return date.toLocaleDateString("sk-SK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatCalendarShortDay(date: Date) {
  return date.toLocaleDateString("sk-SK", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
  });
}

export function buildDriverCalendarEntries(
  requests: DriverRequestSummary[],
): DriverCalendarEntry[] {
  const entries: DriverCalendarEntry[] = [];

  for (const request of requests) {
    for (const response of request.serviceResponses) {
      if (response.status !== "accepted") {
        continue;
      }

      entries.push({
        id: response.id,
        requestId: request.id,
        vehicleLabel: `${request.vehicleName} ${request.year}`,
        licensePlate: request.licensePlate,
        serviceName: response.serviceName,
        appointmentDate: response.appointmentDate,
        appointmentTime: response.appointmentTime,
      });
    }
  }

  return entries.sort((left, right) => {
    const dateCompare = left.appointmentDate.localeCompare(right.appointmentDate);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    return left.appointmentTime.localeCompare(right.appointmentTime);
  });
}

export function groupCalendarEntriesByTime(entries: DriverCalendarEntry[]) {
  const groups = new Map<string, DriverCalendarEntry[]>();

  for (const entry of entries) {
    const timeKey = entry.appointmentTime.slice(0, 5);
    const bucket = groups.get(timeKey) ?? [];
    bucket.push(entry);
    groups.set(timeKey, bucket);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([timeKey, items]) => ({
      timeKey,
      items,
      top: getCalendarAppointmentTop(items[0].appointmentTime),
    }));
}
