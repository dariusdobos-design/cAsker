"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  CALENDAR_HOUR_HEIGHT_REM,
  formatAppointmentLabel,
  formatCalendarHourLabel,
  getCalendarAppointmentTopRem,
  getCalendarHourLabels,
  getCalendarTrackHeightRem,
  isSameDay,
  startOfWeek,
  toDateKey,
  type Appointment,
} from "@/lib/appointments";
import "./map-calendar.css";

type CalendarView = "day" | "week";

const HOURS = getCalendarHourLabels();
const TRACK_HEIGHT_REM = getCalendarTrackHeightRem();

type MapCalendarProps = {
  isOpen: boolean;
  onToggle: () => void;
  appointments: Appointment[];
  onSelectAppointment: (appointment: Appointment) => void;
  onRefresh?: () => void;
  children: React.ReactNode;
};

function formatHeaderDate(date: Date) {
  return date.toLocaleDateString("sk-SK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatShortDay(date: Date) {
  return date.toLocaleDateString("sk-SK", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
  });
}

function groupAppointmentsByTime(appointments: Appointment[]) {
  const groups = new Map<string, Appointment[]>();

  for (const appointment of [...appointments].sort((left, right) =>
    left.appointment_time.localeCompare(right.appointment_time),
  )) {
    const timeKey = appointment.appointment_time.slice(0, 5);
    const bucket = groups.get(timeKey) ?? [];
    bucket.push(appointment);
    groups.set(timeKey, bucket);
  }

  return Array.from(groups.entries()).map(([timeKey, items]) => ({
    timeKey,
    items,
    topRem: getCalendarAppointmentTopRem(items[0].appointment_time),
  }));
}

export function MapCalendar({
  isOpen,
  onToggle,
  appointments,
  onSelectAppointment,
  onRefresh,
  children,
}: MapCalendarProps) {
  const [view, setView] = useState<CalendarView>("day");
  const [referenceDate, setReferenceDate] = useState(() => new Date());
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => {
    setToday(new Date());
  }, []);

  useEffect(() => {
    if (isOpen) onRefresh?.();
  }, [isOpen, onRefresh]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(referenceDate);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [referenceDate]);

  const dayAppointments = useMemo(
    () =>
      appointments.filter(
        (appointment) => appointment.appointment_date === toDateKey(referenceDate),
      ),
    [appointments, referenceDate],
  );

  const dayAppointmentGroups = useMemo(
    () => groupAppointmentsByTime(dayAppointments),
    [dayAppointments],
  );

  const navigate = (direction: -1 | 1) => {
    setReferenceDate((current) =>
      addDays(current, view === "day" ? direction : direction * 7),
    );
  };

  const jumpToToday = () => setReferenceDate(new Date());

  const renderTimeAxis = () => (
    <div
      className="casker-calendar-time-labels"
      style={{ height: `${TRACK_HEIGHT_REM}rem` }}
    >
      {HOURS.map((hour) => (
        <span
          key={hour}
          className="casker-calendar-hour-label"
          style={{ height: `${CALENDAR_HOUR_HEIGHT_REM}rem` }}
        >
          {formatCalendarHourLabel(hour)}
        </span>
      ))}
    </div>
  );

  const renderTimeTrackLines = () => (
    <div className="casker-calendar-time-lines" aria-hidden>
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="casker-calendar-time-line"
          style={{ height: `${CALENDAR_HOUR_HEIGHT_REM}rem` }}
        />
      ))}
    </div>
  );

  const renderAppointmentButton = (
    appointment: Appointment,
    compact = false,
    showTime = true,
  ) => (
    <button
      key={appointment.id}
      type="button"
      className={`casker-calendar-event ${compact ? "is-compact" : ""}`}
      onClick={() => onSelectAppointment(appointment)}
    >
      {showTime ? (
        <span className="casker-calendar-event-time">
          {appointment.appointment_time.slice(0, 5)}
        </span>
      ) : null}
      <span className="casker-calendar-event-title">
        {formatAppointmentLabel(appointment)}
      </span>
    </button>
  );

  const renderPositionedAppointments = (
    groups: ReturnType<typeof groupAppointmentsByTime>,
    compact = false,
  ) =>
    groups.map((group) => (
      <div
        key={group.timeKey}
        className="casker-calendar-event-stack"
        style={{ top: `${group.topRem}rem` }}
      >
        {group.items.map((appointment) =>
          renderAppointmentButton(appointment, compact, !compact),
        )}
      </div>
    ));

  return (
    <div className={`casker-map-shell ${isOpen ? "is-calendar-open" : ""}`}>
      <button
        type="button"
        className="casker-calendar-trigger"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Skryť kalendár" : "Zobraziť kalendár"}
      >
        <span className="casker-calendar-trigger-label">Kalendár</span>
        <ChevronDown className="casker-calendar-trigger-icon" strokeWidth={2.5} />
      </button>

      <div
        className="casker-calendar-drawer"
        aria-hidden={!isOpen}
        inert={!isOpen ? true : undefined}
      >
        <div className="casker-calendar-toolbar">
          <div className="casker-calendar-nav">
            <button
              type="button"
              className="casker-calendar-nav-btn"
              onClick={() => navigate(-1)}
              aria-label="Predchádzajúce obdobie"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              className="casker-calendar-today-btn"
              onClick={jumpToToday}
            >
              Dnes
            </button>
            <button
              type="button"
              className="casker-calendar-nav-btn"
              onClick={() => navigate(1)}
              aria-label="Nasledujúce obdobie"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>

          <div className="casker-calendar-view-switch">
            <button
              type="button"
              className={`casker-calendar-view-btn ${view === "day" ? "is-active" : ""}`}
              onClick={() => setView("day")}
            >
              Deň
            </button>
            <button
              type="button"
              className={`casker-calendar-view-btn ${view === "week" ? "is-active" : ""}`}
              onClick={() => setView("week")}
            >
              Týždeň
            </button>
          </div>

          <p className="casker-calendar-period" suppressHydrationWarning>
            {view === "day"
              ? formatHeaderDate(referenceDate)
              : `${formatShortDay(weekDays[0])} – ${formatShortDay(weekDays[6])}`}
          </p>
        </div>

        <div className="casker-calendar-body">
          {view === "day" ? (
            <div className="casker-calendar-day-view">
              {dayAppointments.length === 0 && (
                <p className="casker-calendar-day-note">
                  Žiadne potvrdené termíny v tomto dni. Po schválení zákazníkom sa
                  zobrazia tu.
                </p>
              )}
              <div className="casker-calendar-time-grid">
                {renderTimeAxis()}
                <div
                  className="casker-calendar-time-track"
                  style={{ height: `${TRACK_HEIGHT_REM}rem` }}
                >
                  {renderTimeTrackLines()}
                  {renderPositionedAppointments(dayAppointmentGroups)}
                </div>
              </div>
            </div>
          ) : (
            <div className="casker-calendar-week-view">
              <div className="casker-calendar-week-time-column">
                <div className="casker-calendar-week-corner" aria-hidden />
                <div
                  className="casker-calendar-time-labels is-week"
                  style={{ height: `${TRACK_HEIGHT_REM}rem` }}
                >
                  {HOURS.map((hour) => (
                    <span
                      key={hour}
                      className="casker-calendar-hour-label"
                      style={{ height: `${CALENDAR_HOUR_HEIGHT_REM}rem` }}
                    >
                      {formatCalendarHourLabel(hour)}
                    </span>
                  ))}
                </div>
              </div>

              {weekDays.map((day) => {
                const dayKey = toDateKey(day);
                const items = appointments.filter(
                  (appointment) => appointment.appointment_date === dayKey,
                );
                const groups = groupAppointmentsByTime(items);

                return (
                  <div
                    key={dayKey}
                    className={`casker-calendar-week-column ${today && isSameDay(day, today) ? "is-today" : ""}`}
                  >
                    <div className="casker-calendar-week-head">
                      <span>{formatShortDay(day)}</span>
                    </div>
                    <div
                      className="casker-calendar-time-track is-week"
                      style={{ height: `${TRACK_HEIGHT_REM}rem` }}
                    >
                      {renderTimeTrackLines()}
                      {groups.length === 0 ? (
                        <span className="casker-calendar-week-empty">Voľno</span>
                      ) : (
                        renderPositionedAppointments(groups, true)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="casker-map-content">{children}</div>
    </div>
  );
}
