"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarClock,
  CalendarSync,
  CheckCircle2,
  ExternalLink,
  MapPin,
  MessageCircle,
  X,
} from "lucide-react";
import {
  CarWrenchIcon,
  CheckboxStateIcon,
  HourglassStateIcon,
} from "./state-icons";
import { BookingPopover } from "./components/booking-popover";
import { ReschedulePopover } from "./components/reschedule-popover";
import { MapCalendar } from "./components/map-calendar";
import { ProfileMenu } from "./components/profile-menu";
import { RequestCardIcon } from "./components/request-card-icon";
import {
  buildAcceptedAppointmentMap,
  buildCalendarAppointments,
  buildPendingAppointmentMap,
  fetchAcceptedAppointments,
  fetchPendingAppointments,
  findRequestForAppointment,
  mergeDemoAcceptedAppointments,
  formatAppointmentDisplayDate,
  formatAppointmentDisplayTime,
  formatAppointmentSchedule,
  subscribeToAppointmentChanges,
  syncAcceptedRequestStatuses,
  type Appointment,
} from "@/lib/appointments";
import {
  formatVehicleCategoryLabel,
  completeRequest,
  fetchRequestById,
  fetchRequests,
  subscribeToRequestChanges,
  type Request,
} from "@/lib/requests";
import { getSupabaseErrorMessage } from "@/lib/supabase-error";

const MIN_DISTANCE = 0;
const MAX_DISTANCE = 150;

function FilterIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="casker-filter-icon"
      aria-hidden
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeMiterlimit={10}
        strokeWidth={1.75}
        d="M21.25 12H8.895m-4.361 0H2.75m18.5 6.607h-5.748m-4.361 0H2.75m18.5-13.214h-3.105m-4.361 0H2.75m13.214 2.18a2.18 2.18 0 1 0 0-4.36a2.18 2.18 0 0 0 0 4.36Zm-9.25 6.607a2.18 2.18 0 1 0 0-4.36a2.18 2.18 0 0 0 0 4.36Zm6.607 6.608a2.18 2.18 0 1 0 0-4.361a2.18 2.18 0 0 0 0 4.36Z"
      />
    </svg>
  );
}

const STATE_CONFIG = {
  inquiry: { label: "Dopyt", Icon: CarWrenchIcon },
  waiting: { label: "Čaká", Icon: HourglassStateIcon },
  done: { label: "Prijaté", Icon: CheckboxStateIcon },
} as const;

const STATE_ORDER = ["inquiry", "waiting", "done"] as const;

type SidebarState = (typeof STATE_ORDER)[number];

const MAP_BACKGROUND =
  "linear-gradient(135deg, #d4e8d4 0%, #b8d4e8 50%, #a8c8dc 100%)";

const MAP_GRID_BACKGROUND = `
  linear-gradient(to right, rgba(255,255,255,0.5) 1px, transparent 1px),
  linear-gradient(to bottom, rgba(255,255,255,0.5) 1px, transparent 1px)
`;

function clampDistance(value: number) {
  return Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, value));
}

function formatDistanceKm(value: number) {
  return value.toLocaleString("sk-SK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

function formatMileage(km: number) {
  return `${km.toLocaleString("sk-SK")} km`;
}

function formatFuelLabel(fuelType: string) {
  if (fuelType === "Nafta") return "Diesel";
  return fuelType;
}

type ChatMessage = {
  id: string;
  text: string;
  from: "service" | "customer";
  sentAt: Date;
};

function createChatMessage(
  text: string,
  from: ChatMessage["from"],
  sentAt: Date = new Date(),
): ChatMessage {
  return {
    id: `${from}-${sentAt.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    from,
    sentAt,
  };
}

function getDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatChatDate(date: Date) {
  const today = new Date();
  if (getDayKey(date) === getDayKey(today)) return "Dnes";

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (getDayKey(date) === getDayKey(yesterday)) return "Včera";

  return date.toLocaleDateString("sk-SK", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

function formatChatTime(date: Date) {
  return date.toLocaleTimeString("sk-SK", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type ChatTimelineItem =
  | { type: "date"; id: string; date: Date }
  | { type: "message"; message: ChatMessage };

function buildChatTimeline(messages: ChatMessage[]): ChatTimelineItem[] {
  const items: ChatTimelineItem[] = [];
  let lastDayKey: string | null = null;

  for (const message of messages) {
    const dayKey = getDayKey(message.sentAt);
    if (dayKey !== lastDayKey) {
      items.push({
        type: "date",
        id: `date-${dayKey}`,
        date: message.sentAt,
      });
      lastDayKey = dayKey;
    }
    items.push({ type: "message", message });
  }

  return items;
}

const CHAT_DEFAULT_HEIGHT = 240;
const CHAT_MIN_HEIGHT = 192;
const CHAT_MAX_HEIGHT_PX = 480;

function getChatMaxHeight() {
  if (typeof window === "undefined") return CHAT_MAX_HEIGHT_PX;
  return Math.min(window.innerHeight * 0.75, CHAT_MAX_HEIGHT_PX);
}

function clampChatHeight(value: number) {
  return Math.min(getChatMaxHeight(), Math.max(CHAT_MIN_HEIGHT, value));
}

type ChatPanelProps = {
  request: Request;
  top: number;
  right: number;
  panelRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
};

function ChatPanel({
  request,
  top,
  right,
  panelRef,
  onClose,
}: ChatPanelProps) {
  const [height, setHeight] = useState(CHAT_DEFAULT_HEIGHT);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    createChatMessage(
      request.inquiryDescription,
      "customer",
      new Date(Date.now() - 2 * 60 * 60 * 1000),
    ),
  ]);
  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const resizeStateRef = useRef<{ startY: number; startHeight: number } | null>(
    null,
  );
  const chatTimeline = useMemo(() => buildChatTimeline(messages), [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!resizeStateRef.current) return;

      const { startY, startHeight } = resizeStateRef.current;
      const nextHeight = startHeight + (startY - event.clientY);
      setHeight(clampChatHeight(nextHeight));
    };

    const handleMouseUp = () => {
      if (!resizeStateRef.current) return;
      resizeStateRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  const handleResizeStart = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    resizeStateRef.current = {
      startY: event.clientY,
      startHeight: height,
    };
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
  };

  const handleSendMessage = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    setMessages((current) => [...current, createChatMessage(text, "service")]);
    setDraft("");
  };

  return (
    <div
      ref={panelRef}
      className="casker-chat-popover"
      role="dialog"
      aria-label={`Chat s ${request.userName}`}
      style={{ top, right, height }}
    >
      <button
        type="button"
        className="casker-chat-resize-handle"
        onMouseDown={handleResizeStart}
        aria-label="Zmeniť výšku chatu"
      />

      <div className="casker-chat-popover-header">
        <span className="casker-chat-popover-title">Chat · {request.userName}</span>
        <button
          type="button"
          className="casker-chat-popover-close"
          onClick={onClose}
          aria-label="Zavrieť chat"
        >
          <X className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </div>

      <div className="casker-chat-messages">
        <div className="casker-chat-message-list">
          {chatTimeline.map((item) => {
            if (item.type === "date") {
              return (
                <div key={item.id} className="casker-chat-date-divider">
                  <time dateTime={item.date.toISOString()}>
                    {formatChatDate(item.date)}
                  </time>
                </div>
              );
            }

            const message = item.message;
            const isOutgoing = message.from === "service";

            return (
              <div
                key={message.id}
                className={`casker-chat-message ${isOutgoing ? "is-outgoing" : "is-incoming"}`}
              >
                <div className="casker-chat-message-meta">
                  <span className="casker-chat-message-author">
                    {isOutgoing ? "Servis" : request.userName}
                  </span>
                  <time
                    className="casker-chat-message-time"
                    dateTime={message.sentAt.toISOString()}
                  >
                    {formatChatTime(message.sentAt)}
                  </time>
                </div>
                <p className="casker-chat-message-text">{message.text}</p>
              </div>
            );
          })}
          <div ref={messagesEndRef} className="casker-chat-messages-end" />
        </div>
      </div>

      <form className="casker-chat-compose" onSubmit={handleSendMessage}>
        <input
          type="text"
          className="casker-chat-input"
          placeholder="Vaša správa…"
          aria-label="Text správy"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="casker-chat-send-btn">
          Odoslať
        </button>
      </form>
    </div>
  );
}

function CompleteConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onCancel]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="casker-dialog-backdrop" onClick={onCancel}>
      <div
        className="casker-dialog"
        role="alertdialog"
        aria-labelledby="complete-dialog-title"
        aria-describedby="complete-dialog-desc"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="complete-dialog-title" className="casker-dialog-title">
          Označiť dopyt ako Hotové?
        </h3>
        <p id="complete-dialog-desc" className="casker-dialog-text">
          (Hotové dopyty môžete nájsť v História dopytov)
        </p>
        <div className="casker-dialog-actions">
          <button type="button" className="casker-dialog-btn-secondary" onClick={onCancel}>
            Nie
          </button>
          <button type="button" className="casker-complete-btn" onClick={onConfirm}>
            Áno
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SentResponseInline({ appointment }: { appointment: Appointment }) {
  return (
    <div className="casker-sent-inline-panel">
      <div className="casker-sent-meta-row">
        <span className="casker-sent-meta-label">Dátum</span>
        <span className="casker-sent-meta-value">
          {formatAppointmentDisplayDate(appointment.appointment_date)}
        </span>
      </div>
      <div className="casker-sent-meta-row">
        <span className="casker-sent-meta-label">Čas</span>
        <span className="casker-sent-meta-value">
          {formatAppointmentDisplayTime(appointment.appointment_time)}
        </span>
      </div>
      {appointment.message ? (
        <div className="casker-sent-message-frame">
          <p className="casker-sent-message-label">Správa</p>
          <p className="casker-sent-message-text">{appointment.message}</p>
        </div>
      ) : null}
    </div>
  );
}

function RequestDetailPanel({
  request,
  pendingAppointment,
  acceptedAppointment,
  onAppointmentCreated,
  onRequestCompleted,
}: {
  request: Request;
  pendingAppointment: Appointment | null;
  acceptedAppointment: Appointment | null;
  onAppointmentCreated: (requestId: string) => void;
  onRequestCompleted: (requestId: string) => void;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [sentOpen, setSentOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [chatPos, setChatPos] = useState({ top: 0, right: 0 });
  const chatBtnRef = useRef<HTMLButtonElement>(null);
  const respondBtnRef = useRef<HTMLButtonElement>(null);
  const rescheduleBtnRef = useRef<HTMLButtonElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const isWaiting = request.status === "waiting";
  const isDone = request.status === "done";

  const updateChatPanelPosition = useCallback(() => {
    const btn = chatBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setChatPos({
      top: rect.top - 8,
      right: window.innerWidth - rect.right,
    });
  }, []);

  const closeChat = () => setChatOpen(false);

  const toggleChat = () => {
    if (!chatOpen) updateChatPanelPosition();
    setChatOpen((open) => !open);
  };

  useEffect(() => {
    setChatOpen(false);
    setBookingOpen(false);
    setRescheduleOpen(false);
    setSentOpen(false);
    setCompleteDialogOpen(false);
  }, [request.id]);

  const handleConfirmComplete = async () => {
    setCompleteDialogOpen(false);
    setCompleteError(null);
    setIsCompleting(true);
    try {
      await completeRequest(request);
      onRequestCompleted(request.id);
    } catch (error) {
      console.error("Nepodarilo sa dokončiť dopyt:", getSupabaseErrorMessage(error));
      setCompleteError("Dopyt sa nepodarilo označiť ako hotový. Skontrolujte oprávnenia v Supabase.");
    } finally {
      setIsCompleting(false);
    }
  };

  useEffect(() => {
    if (!chatOpen) return;

    updateChatPanelPosition();

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (chatBtnRef.current?.contains(target)) return;
      if (chatPanelRef.current?.contains(target)) return;
      setChatOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setChatOpen(false);
    };

    window.addEventListener("resize", updateChatPanelPosition);
    window.addEventListener("scroll", updateChatPanelPosition, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("resize", updateChatPanelPosition);
      window.removeEventListener("scroll", updateChatPanelPosition, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [chatOpen, updateChatPanelPosition]);

  return (
    <div className="casker-bottom-panel-inner">
      <div className="casker-detail-top-actions">
        <span className="casker-detail-ecv">
          EČV: <strong>{request.licensePlate}</strong>
        </span>
      </div>

      <div className="casker-detail-layout">
        <div className="casker-vehicle-detail">
          <div className="casker-vehicle-detail-header">
            <span className="casker-vehicle-detail-label">
              Informácie o vozidle
            </span>
          </div>

          <h3 className="casker-vehicle-detail-title">{request.vehicleTitle}</h3>

          <div className="casker-vehicle-specs-group">
            <div className="casker-vehicle-primary-bar">
              <div className="casker-vehicle-specs-row casker-vehicle-primary-row">
                <span>
                  Typ:{" "}
                  <strong>{formatVehicleCategoryLabel(request.vehicleCategory)}</strong>
                </span>
                <span className="casker-primary-sep">,</span>
                <span>
                  Rok výroby: <strong>{request.year}</strong>
                </span>
                <span className="casker-primary-sep">,</span>
                <span>
                  Motor: <strong>{request.engine}</strong>
                </span>
                <span className="casker-primary-sep">,</span>
                <span>
                  Výkon: <strong>{request.power}</strong>
                </span>
                <span className="casker-primary-sep">,</span>
                <span>
                  Palivo: <strong>{formatFuelLabel(request.fuelType)}</strong>
                </span>
              </div>
            </div>

            <p className="casker-vehicle-secondary-specs casker-vehicle-specs-row">
              VIN: <strong>{request.vin}</strong>
              <span className="casker-meta-divider"> | </span>
              KM: <strong>{formatMileage(request.mileageKm)}</strong>
              <span className="casker-meta-divider"> | </span>
              Prevodovka: <strong>{request.transmission}</strong>
              <span className="casker-meta-divider"> | </span>
              Pohon: <strong>{request.drive}</strong>
              <span className="casker-meta-divider"> | </span>
              Karoséria: <strong>{request.bodyType}</strong>
              <span className="casker-meta-divider"> | </span>
              Dvere: <strong>{request.doors}</strong>
            </p>
          </div>

          <div className="casker-inquiry-frame">
            <p className="casker-inquiry-description-label">Popis dopytu:</p>
            <p className="casker-inquiry-description-text">
              {request.inquiryDescription}
            </p>
          </div>
        </div>

        <aside className="casker-detail-contact" aria-label="Kontakt na užívateľa">
          <div className="casker-user-info">
            <p className="casker-user-info-title">Užívateľ</p>
            <div className="casker-user-info-row">
              <span className="casker-user-info-label">Meno</span>
              <span className="casker-user-info-value">{request.userName}</span>
            </div>
            <div className="casker-user-info-row">
              <span className="casker-user-info-label">Lokácia</span>
              <span className="casker-user-info-value">
                {request.locationCity}
                <span className="casker-user-info-muted">
                  {" "}
                  · {formatDistanceKm(request.distanceKm)} km od servisu
                </span>
              </span>
            </div>
            <div className="casker-user-info-row">
              <span className="casker-user-info-label">Telefón</span>
              <a
                href={`tel:${request.phone.replace(/\s/g, "")}`}
                className="casker-user-info-phone"
              >
                {request.phone}
              </a>
            </div>
          </div>

          <div className="casker-detail-action-block">
            <div className="casker-detail-actions">
              {request.status === "inquiry" ? (
                <button
                  ref={respondBtnRef}
                  type="button"
                  className="casker-respond-btn"
                  onClick={() => setBookingOpen((open) => !open)}
                  aria-expanded={bookingOpen}
                  aria-label="Odpovedať na dopyt"
                >
                  Odpovedať na dopyt
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.35} />
                </button>
              ) : isWaiting ? (
                <button
                  type="button"
                  className={`casker-sent-btn ${sentOpen ? "is-open" : ""}`}
                  onClick={() => {
                    setSentOpen((open) => !open);
                    setBookingOpen(false);
                  }}
                  aria-expanded={sentOpen}
                  aria-label="Odoslané"
                >
                  Odoslané
                  <CalendarClock className="h-3.5 w-3.5" strokeWidth={2.35} />
                </button>
              ) : isDone ? (
                <>
                  <button
                    ref={rescheduleBtnRef}
                    type="button"
                    className={`casker-reschedule-btn ${rescheduleOpen ? "is-open" : ""}`}
                    onClick={() => {
                      setRescheduleOpen((open) => !open);
                      setCompleteDialogOpen(false);
                    }}
                    aria-expanded={rescheduleOpen}
                    aria-label="Zmeniť termín"
                  >
                    <CalendarSync className="h-5 w-5" strokeWidth={2.25} />
                  </button>
                  <button
                    type="button"
                    className="casker-complete-btn"
                    onClick={() => {
                      setRescheduleOpen(false);
                      setCompleteDialogOpen(true);
                    }}
                    disabled={isCompleting}
                    aria-label="Hotové"
                  >
                    Hotové
                    <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.35} />
                  </button>
                </>
              ) : null}
              <button
                ref={chatBtnRef}
                type="button"
                className="casker-chat-btn"
                onClick={toggleChat}
                aria-label="Chat"
                aria-expanded={chatOpen}
              >
                <MessageCircle className="h-3.5 w-3.5" strokeWidth={2.35} />
                Chat
              </button>
            </div>

            {completeError ? (
              <p className="casker-detail-error">{completeError}</p>
            ) : null}

            {isWaiting && sentOpen ? (
              pendingAppointment ? (
                <SentResponseInline appointment={pendingAppointment} />
              ) : (
                <p className="casker-sent-empty">
                  Pre tento dopyt zatiaľ nie sú uložené údaje o odoslanom termíne.
                </p>
              )
            ) : null}
          </div>

          {request.status === "inquiry" ? (
            <BookingPopover
              request={request}
              anchorRef={respondBtnRef}
              isOpen={bookingOpen}
              onClose={() => setBookingOpen(false)}
              onCreated={onAppointmentCreated}
            />
          ) : null}

          {isDone ? (
            <ReschedulePopover
              request={request}
              currentAppointment={acceptedAppointment ?? pendingAppointment}
              anchorRef={rescheduleBtnRef}
              isOpen={rescheduleOpen}
              onClose={() => setRescheduleOpen(false)}
              onRescheduled={onAppointmentCreated}
            />
          ) : null}

          <CompleteConfirmDialog
            isOpen={completeDialogOpen}
            onConfirm={() => void handleConfirmComplete()}
            onCancel={() => setCompleteDialogOpen(false)}
          />

          {chatOpen &&
            typeof document !== "undefined" &&
            createPortal(
              <ChatPanel
                key={request.id}
                request={request}
                top={chatPos.top}
                right={chatPos.right}
                panelRef={chatPanelRef}
                onClose={closeChat}
              />,
              document.body,
            )}
        </aside>
      </div>
    </div>
  );
}

type FilterPanelProps = {
  radiusKm: number;
  top: number;
  left: number;
  panelRef: React.RefObject<HTMLDivElement | null>;
  onRadiusChange: (value: number) => void;
  onApply: () => void;
};

function FilterPanel({
  radiusKm,
  top,
  left,
  panelRef,
  onRadiusChange,
  onApply,
}: FilterPanelProps) {
  return (
    <div
      ref={panelRef}
      className="casker-filter-panel"
      role="dialog"
      aria-label="Filter dopytov"
      style={{
        top,
        left,
        transform: "translateY(-50%)",
      }}
    >
      <label htmlFor="distance-radius" className="casker-filter-label">
        Vyhľadať dopyt v okolí do:
      </label>

      <div className="casker-range-input-row">
        <input
          id="distance-radius"
          type="range"
          min={MIN_DISTANCE}
          max={MAX_DISTANCE}
          value={radiusKm}
          onChange={(e) => onRadiusChange(Number(e.target.value))}
        />
        <input
          type="number"
          className="casker-range-number"
          min={MIN_DISTANCE}
          max={MAX_DISTANCE}
          value={radiusKm}
          aria-label="Vzdialenosť v km"
          onChange={(e) => onRadiusChange(Number(e.target.value))}
        />
        <span className="casker-range-unit">km</span>
      </div>

      <button type="button" className="casker-filter-apply" onClick={onApply}>
        Použiť filter
      </button>
    </div>
  );
}

export default function Home() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [activeState, setActiveState] = useState<SidebarState>("inquiry");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchRadius, setSearchRadius] = useState(150);
  const [appliedRadius, setAppliedRadius] = useState(150);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [acceptedAppointments, setAcceptedAppointments] = useState<Appointment[]>(
    [],
  );
  const [pendingAppointments, setPendingAppointments] = useState<Appointment[]>(
    [],
  );

  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const [filterPanelPos, setFilterPanelPos] = useState({ top: 0, left: 0 });

  const updateFilterPanelPosition = useCallback(() => {
    const btn = filterBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setFilterPanelPos({
      top: rect.top + rect.height / 2,
      left: rect.right + 10,
    });
  }, []);

  const toggleFilter = () => {
    if (!filterOpen) updateFilterPanelPosition();
    setFilterOpen((open) => !open);
  };

  const { label: sectionLabel } = STATE_CONFIG[activeState];

  const handleRadiusChange = (raw: number) => {
    setSearchRadius(clampDistance(Number.isFinite(raw) ? raw : MAX_DISTANCE));
  };

  const pendingByRequestId = useMemo(
    () => buildPendingAppointmentMap(pendingAppointments, requests),
    [pendingAppointments, requests],
  );

  const acceptedByRequestId = useMemo(
    () => buildAcceptedAppointmentMap(acceptedAppointments, requests),
    [acceptedAppointments, requests],
  );

  const calendarAppointments = useMemo(
    () =>
      buildCalendarAppointments(
        mergeDemoAcceptedAppointments(acceptedAppointments),
        pendingAppointments,
        requests,
      ),
    [acceptedAppointments, pendingAppointments, requests],
  );

  const filteredRequests = useMemo(
    () =>
      requests.filter(
        (r) => r.status === activeState && r.distanceKm <= appliedRadius,
      ),
    [requests, activeState, appliedRadius],
  );

  const selectedRequest = useMemo(() => {
    if (!selectedRequestId) return null;
    const request = requests.find((r) => r.id === selectedRequestId);
    if (!request || request.status !== activeState) return null;
    if (request.distanceKm > appliedRadius) return null;
    return request;
  }, [requests, selectedRequestId, activeState, appliedRadius]);

  const handleSelectRequest = (id: string) => {
    setSelectedRequestId(id);
  };

  const handleStateChange = (state: SidebarState) => {
    setActiveState(state);
    setSelectedRequestId(null);
    setFilterOpen(false);
  };

  const handleApplyFilter = () => {
    setAppliedRadius(searchRadius);
    setSelectedRequestId(null);
    setFilterOpen(false);
  };

  const refreshTimeoutRef = useRef<number | null>(null);

  const refreshDashboardData = useCallback(async () => {
    try {
      await syncAcceptedRequestStatuses();
    } catch (syncError) {
      console.warn(
        "Synchronizácia stavov dopytov zlyhala:",
        getSupabaseErrorMessage(syncError),
      );
    }

    try {
      const [nextAppointments, nextPending] = await Promise.all([
        fetchAcceptedAppointments(),
        fetchPendingAppointments(),
      ]);
      setAcceptedAppointments(nextAppointments);
      setPendingAppointments(nextPending);
    } catch (appointmentsError) {
      console.warn(
        "Termíny sa nepodarilo načítať:",
        getSupabaseErrorMessage(appointmentsError),
      );
    }

    try {
      const nextRequests = await fetchRequests({ allowFallback: true });
      setRequests(nextRequests);
    } catch (requestError) {
      console.warn(
        "Dopyty sa nepodarilo načítať z DB:",
        getSupabaseErrorMessage(requestError),
      );
    }
  }, []);

  const scheduleDashboardRefresh = useCallback(() => {
    if (refreshTimeoutRef.current !== null) {
      window.clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = window.setTimeout(() => {
      refreshTimeoutRef.current = null;
      void refreshDashboardData();
    }, 200);
  }, [refreshDashboardData]);

  useEffect(() => {
    void refreshDashboardData();
  }, [refreshDashboardData]);

  useEffect(() => {
    const unsubscribeAppointments = subscribeToAppointmentChanges(() => {
      scheduleDashboardRefresh();
    });
    const unsubscribeRequests = subscribeToRequestChanges(() => {
      scheduleDashboardRefresh();
    });

    return () => {
      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current);
      }
      unsubscribeAppointments();
      unsubscribeRequests();
    };
  }, [scheduleDashboardRefresh]);

  const handleAppointmentSelect = async (appointment: Appointment) => {
    let matchedRequest = findRequestForAppointment(appointment, requests);

    if (!matchedRequest && appointment.request_id) {
      matchedRequest = await fetchRequestById(appointment.request_id);
    }

    if (!matchedRequest || matchedRequest.status === "completed") return;

    if (
      matchedRequest.status === "inquiry" ||
      matchedRequest.status === "waiting" ||
      matchedRequest.status === "done"
    ) {
      setActiveState(matchedRequest.status);
    }
    setSelectedRequestId(matchedRequest.id);
  };

  const handleAppointmentCreated = (requestId: string) => {
    setSelectedRequestId(requestId);
    setActiveState("waiting");
    setRequests((current) =>
      current.map((request) =>
        request.id === requestId ? { ...request, status: "waiting" } : request,
      ),
    );
    void refreshDashboardData();
  };

  const handleRequestCompleted = (requestId: string) => {
    setRequests((current) =>
      current.filter((request) => request.id !== requestId),
    );
    setSelectedRequestId(null);
    void refreshDashboardData();
  };

  useEffect(() => {
    if (!filterOpen) return;

    updateFilterPanelPosition();

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (filterBtnRef.current?.contains(target)) return;
      if (filterPanelRef.current?.contains(target)) return;
      setFilterOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFilterOpen(false);
    };

    window.addEventListener("resize", updateFilterPanelPosition);
    window.addEventListener("scroll", updateFilterPanelPosition, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("resize", updateFilterPanelPosition);
      window.removeEventListener("scroll", updateFilterPanelPosition, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [filterOpen, updateFilterPanelPosition]);

  return (
    <div className="casker-dashboard font-sans">
      <aside className="casker-sidebar">
        <header className="casker-sidebar-header">
          <h1 className="casker-logo" aria-label="cAsker">
            <span className="casker-logo-text">c</span>
            <CarWrenchIcon className="casker-logo-icon" />
            <span className="casker-logo-text">sker</span>
          </h1>
        </header>

        <div className="casker-sidebar-scroll">
          <div className="casker-state-row">
            <div className="casker-state-switcher">
              {STATE_ORDER.map((state) => {
                const { Icon } = STATE_CONFIG[state];
                const isActive = activeState === state;

                return (
                  <button
                    key={state}
                    type="button"
                    className="casker-state-btn"
                    onClick={() => handleStateChange(state)}
                    aria-label={STATE_CONFIG[state].label}
                    aria-pressed={isActive}
                  >
                    <span
                      className={`casker-state-btn-inner ${isActive ? "is-active" : "is-inactive"}`}
                    >
                      <Icon />
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              ref={filterBtnRef}
              type="button"
              className={`casker-filter-btn ${filterOpen ? "is-open" : ""}`}
              onClick={toggleFilter}
              aria-label="Filter dopytov"
              aria-expanded={filterOpen}
            >
              <FilterIcon />
            </button>
          </div>

          {filterOpen &&
            typeof document !== "undefined" &&
            createPortal(
              <FilterPanel
                radiusKm={searchRadius}
                top={filterPanelPos.top}
                left={filterPanelPos.left}
                panelRef={filterPanelRef}
                onRadiusChange={handleRadiusChange}
                onApply={handleApplyFilter}
              />,
              document.body,
            )}

          <h2 className="pb-3 text-center text-xl font-bold text-zinc-900">
            {sectionLabel}
          </h2>

          <div className="casker-request-list">
            {filteredRequests.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">
                Žiadne dopyty do {appliedRadius} km
              </p>
            ) : (
              filteredRequests.map((request) => {
                const isSelected = selectedRequestId === request.id;
                const pendingAppointment = pendingByRequestId.get(request.id);
                const acceptedAppointment = acceptedByRequestId.get(request.id);
                const cardAppointment =
                  activeState === "waiting"
                    ? pendingAppointment
                    : activeState === "done"
                      ? (acceptedAppointment ?? pendingAppointment)
                      : null;

                return (
                  <button
                    key={request.id}
                    type="button"
                    className={`casker-request-card ${isSelected ? "is-selected" : ""}`}
                    onClick={() => handleSelectRequest(request.id)}
                    aria-pressed={isSelected}
                  >
                    <div className="flex w-full items-start gap-2">
                      <div className="casker-card-icon">
                        <RequestCardIcon category={request.vehicleCategory} />
                      </div>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <h3 className="text-base font-bold leading-tight text-zinc-900">
                          {request.vehicleName} {request.year}
                        </h3>
                        <p className="casker-request-service text-red-600">
                          {request.service}
                        </p>
                        {cardAppointment ? (
                          <p
                            className={`casker-request-schedule ${activeState === "done" ? "is-accepted" : ""}`}
                          >
                            <CalendarClock
                              className="h-3 w-3 shrink-0"
                              strokeWidth={2.25}
                            />
                            <span>{formatAppointmentSchedule(cardAppointment)}</span>
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="casker-tag">
                        EČ - {request.licensePlate}
                      </span>
                      <div className="flex shrink-0 items-center gap-1 text-xs font-medium text-zinc-700">
                        <MapPin className="h-3.5 w-3.5 text-[#0B194F]" />
                        <span>{formatDistanceKm(request.distanceKm)} km</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <footer className="casker-sidebar-footer">
          <span className="text-sm font-medium text-gray-600">
            Názov servisu
          </span>
          <ProfileMenu />
        </footer>
      </aside>

      <main className="casker-main">
        <MapCalendar
          isOpen={calendarOpen}
          onToggle={() => setCalendarOpen((open) => !open)}
          appointments={calendarAppointments}
          onSelectAppointment={handleAppointmentSelect}
          onRefresh={refreshDashboardData}
        >
          <section
            className="casker-map"
            style={{ background: MAP_BACKGROUND }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage: MAP_GRID_BACKGROUND,
                backgroundSize: "32px 32px",
              }}
            />
            <p className="relative z-10 max-w-md px-6 text-center text-sm font-medium text-zinc-700/90">
              [Google Maps / Mapbox Live View - Žilina Region]
            </p>
          </section>
        </MapCalendar>

        <section className="casker-bottom-panel" aria-label="Detail dopytu">
          {selectedRequest ? (
            <RequestDetailPanel
              request={selectedRequest}
              pendingAppointment={pendingByRequestId.get(selectedRequest.id) ?? null}
              acceptedAppointment={acceptedByRequestId.get(selectedRequest.id) ?? null}
              onAppointmentCreated={handleAppointmentCreated}
              onRequestCompleted={handleRequestCompleted}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-zinc-500">
              Kliknite na dopyt v ľavom zozname pre zobrazenie detailov
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
