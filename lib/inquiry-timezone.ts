export const INQUIRY_TIMEZONE = "Europe/Bratislava";

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
};

function readZonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
  };
}

export function getZonedDateKey(date: Date, timeZone = INQUIRY_TIMEZONE) {
  const { year, month, day } = readZonedDateParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isInquiryCalendarDayBeforeToday(
  createdAt: string | Date,
  now = new Date(),
  timeZone = INQUIRY_TIMEZONE,
) {
  const createdDate = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  if (Number.isNaN(createdDate.getTime())) {
    return false;
  }

  return getZonedDateKey(createdDate, timeZone) < getZonedDateKey(now, timeZone);
}
