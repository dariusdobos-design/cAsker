"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarSync, Clock, X } from "lucide-react";
import {
  formatVehicleInfo,
  getAppointmentDateTimeValidationError,
  parseBookingTimeInput,
  rescheduleAppointment,
  toDateKey,
  type Appointment,
  type AppointmentServiceInfo,
} from "@/lib/appointments";
import type { Request } from "@/lib/requests";
import { getSupabaseErrorMessage } from "@/lib/supabase-error";

type ReschedulePopoverProps = {
  request: Request;
  currentAppointment: Appointment | null;
  serviceInfo?: AppointmentServiceInfo;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  onClose: () => void;
  onRescheduled: (requestId: string) => void;
};

function getSubmitErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : getSupabaseErrorMessage(error);
  if (message.includes("fix-casker-db-permissions.sql")) return message;
  if (message.includes("row-level security") || message.includes("RLS") || message.includes("42501")) {
    return "Chýba oprávnenie v databáze. Spustite supabase/fix-casker-db-permissions.sql v Supabase SQL editore.";
  }
  return message || "Termín sa nepodarilo zmeniť.";
}

const BOOKING_HOURS = Array.from({ length: 24 }, (_, index) =>
  String(index).padStart(2, "0"),
);
const BOOKING_MINUTES = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0"),
);

export function ReschedulePopover({
  request,
  currentAppointment,
  serviceInfo,
  anchorRef,
  isOpen,
  onClose,
  onRescheduled,
}: ReschedulePopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const timeInputWrapRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);
  const isTimePickerOpenRef = useRef(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const [appointmentDate, setAppointmentDate] = useState(() => toDateKey(new Date()));
  const [appointmentTime, setAppointmentTime] = useState("08:00");
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  isTimePickerOpenRef.current = isTimePickerOpen;

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setPosition({
      top: rect.top - 8,
      right: window.innerWidth - rect.right,
    });
  }, [anchorRef]);

  const normalizeTimeField = () => {
    const parsed = parseBookingTimeInput(appointmentTime);
    if (parsed) setAppointmentTime(parsed);
  };

  const parsedTime = parseBookingTimeInput(appointmentTime);
  const selectedHour = parsedTime?.split(":")[0] ?? "08";
  const selectedMinute = parsedTime?.split(":")[1] ?? "00";

  const setTimeFromParts = (hour: string, minute: string) => {
    setAppointmentTime(`${hour}:${minute}`);
  };

  useEffect(() => {
    if (!isTimePickerOpen) return;

    const scrollSelectedIntoView = (
      listRef: React.RefObject<HTMLDivElement | null>,
      value: string,
    ) => {
      const option = listRef.current?.querySelector<HTMLElement>(
        `[data-value="${value}"]`,
      );
      option?.scrollIntoView({ block: "center" });
    };

    window.requestAnimationFrame(() => {
      scrollSelectedIntoView(hourListRef, selectedHour);
      scrollSelectedIntoView(minuteListRef, selectedMinute);
    });
  }, [isTimePickerOpen, selectedHour, selectedMinute]);

  useEffect(() => {
    if (!isTimePickerOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (timeInputWrapRef.current?.contains(target)) return;
      setIsTimePickerOpen(false);
    };

    const timeoutId = window.setTimeout(() => {
      document.addEventListener("mousedown", handlePointerDown);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isTimePickerOpen]);

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();
    setError(null);
    setSuccess(false);
    setIsTimePickerOpen(false);
    setAppointmentDate(currentAppointment?.appointment_date ?? toDateKey(new Date()));
    setAppointmentTime(
      currentAppointment?.appointment_time.slice(0, 5) ?? "08:00",
    );
    setMessage("");
  }, [currentAppointment, isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      onClose();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (isTimePickerOpenRef.current) {
        setIsTimePickerOpen(false);
        return;
      }
      onClose();
    };

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [anchorRef, isOpen, onClose, updatePosition]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const validationError = getAppointmentDateTimeValidationError(
      appointmentDate,
      appointmentTime,
    );
    if (validationError) {
      setError(validationError);
      const normalizedTime = parseBookingTimeInput(appointmentTime);
      if (normalizedTime) setAppointmentTime(normalizedTime);
      return;
    }

    const parsed = parseBookingTimeInput(appointmentTime);
    if (!parsed) return;

    setAppointmentTime(parsed);
    setIsSubmitting(true);

    try {
      await rescheduleAppointment({
        request,
        appointmentDate,
        appointmentTime: parsed,
        message,
        serviceInfo,
      });
      setSuccess(true);
      onRescheduled(request.id);
      window.setTimeout(() => onClose(), 900);
    } catch (submitError) {
      setError(getSubmitErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      className="casker-booking-popover"
      role="dialog"
      aria-label="Zmeniť termín"
      style={{ top: position.top, right: position.right }}
    >
      <div className="casker-booking-popover-header">
        <span className="casker-booking-popover-title">
          <CalendarSync className="h-4 w-4" strokeWidth={2.25} />
          Zmeniť termín
        </span>
        <button
          type="button"
          className="casker-booking-popover-close"
          onClick={onClose}
          aria-label="Zavrieť"
        >
          <X className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </div>

      <p className="casker-booking-popover-subtitle">
        {request.userName} · {formatVehicleInfo(request)}
      </p>

      <form className="casker-booking-form" onSubmit={handleSubmit}>
        <div className="casker-booking-datetime-row">
          <label className="casker-booking-field">
            <span>Dátum</span>
            <input
              type="date"
              className="casker-booking-input casker-booking-input--numeric"
              value={appointmentDate}
              min={toDateKey(new Date())}
              onChange={(event) => setAppointmentDate(event.target.value)}
              required
            />
          </label>

          <label className="casker-booking-field">
            <span>Čas</span>
            <div className="casker-booking-time-input-wrap" ref={timeInputWrapRef}>
              <input
                type="text"
                className="casker-booking-input casker-booking-input--numeric casker-booking-input--with-action"
                value={appointmentTime}
                onChange={(event) => setAppointmentTime(event.target.value)}
                onBlur={normalizeTimeField}
                onFocus={() => setIsTimePickerOpen(false)}
                inputMode="numeric"
                placeholder="08:00"
                autoComplete="off"
                spellCheck={false}
                required
              />
              <button
                type="button"
                className={`casker-booking-input-action${isTimePickerOpen ? " is-active" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setIsTimePickerOpen((open) => !open)}
                aria-label="Vybrať čas"
                aria-expanded={isTimePickerOpen}
              >
                <Clock className="h-4 w-4" strokeWidth={2.25} />
              </button>

              {isTimePickerOpen && (
                <div className="casker-booking-time-picker" role="dialog" aria-label="Výber času">
                  <div className="casker-booking-time-picker-columns">
                    <div className="casker-booking-time-picker-column">
                      <span className="casker-booking-time-picker-label">Hod.</span>
                      <div
                        ref={hourListRef}
                        className="casker-booking-time-picker-list"
                        role="listbox"
                        aria-label="Hodiny"
                      >
                        {BOOKING_HOURS.map((hour) => (
                          <button
                            key={hour}
                            type="button"
                            role="option"
                            data-value={hour}
                            aria-selected={hour === selectedHour}
                            className={`casker-booking-time-picker-option${
                              hour === selectedHour ? " is-selected" : ""
                            }`}
                            onClick={() => setTimeFromParts(hour, selectedMinute)}
                          >
                            {hour}
                          </button>
                        ))}
                      </div>
                    </div>

                    <span className="casker-booking-time-picker-separator" aria-hidden="true">
                      :
                    </span>

                    <div className="casker-booking-time-picker-column">
                      <span className="casker-booking-time-picker-label">Min.</span>
                      <div
                        ref={minuteListRef}
                        className="casker-booking-time-picker-list"
                        role="listbox"
                        aria-label="Minúty"
                      >
                        {BOOKING_MINUTES.map((minute) => (
                          <button
                            key={minute}
                            type="button"
                            role="option"
                            data-value={minute}
                            aria-selected={minute === selectedMinute}
                            className={`casker-booking-time-picker-option${
                              minute === selectedMinute ? " is-selected" : ""
                            }`}
                            onClick={() => setTimeFromParts(selectedHour, minute)}
                          >
                            {minute}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </label>
        </div>

        <label className="casker-booking-field">
          <span>Správa</span>
          <textarea
            className="casker-booking-textarea"
            value={message}
            rows={3}
            placeholder="Nový termín a správa pre zákazníka…"
            onChange={(event) => setMessage(event.target.value)}
          />
        </label>

        {error && <p className="casker-booking-error">{error}</p>}
        {success && (
          <p className="casker-booking-success">
            Nový termín odoslaný na schválenie.
          </p>
        )}

        <button
          type="submit"
          className="casker-booking-submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Odosielam…" : "Odoslať"}
        </button>
      </form>
    </div>,
    document.body,
  );
}
