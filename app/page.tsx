"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CalendarSync,
  CheckCircle2,
  ExternalLink,
  Info,
  MapPin,
  MessageCircle,
  Search,
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
import {
  ManageAccountDialog,
  SubscriptionDialog,
  type CompanyAccountForm,
} from "./components/company-account-dialogs";
import { AddressAutocompleteField } from "./components/address-autocomplete-field";
import { RequestCardIcon } from "./components/request-card-icon";
import { VehicleDetailSpecs } from "./components/vehicle-detail-specs";
import {
  buildAcceptedAppointmentMap,
  buildCalendarAppointments,
  buildPendingAppointmentMap,
  buildProposalMap,
  buildInquiryProposalTimeline,
  fetchAcceptedAppointments,
  fetchAppointmentProposals,
  fetchPendingAppointments,
  findRequestForAppointment,
  mergeDemoAcceptedAppointments,
  formatAppointmentSchedule,
  formatProposalSchedule,
  formatProposalSentAt,
  requestCustomerReschedule,
  subscribeToAppointmentChanges,
  syncAcceptedRequestStatuses,
  type Appointment,
  type AppointmentProposal,
} from "@/lib/appointments";
import {
  cancelRequest,
  completeRequest,
  fetchRequestById,
  fetchRequests,
  formatRequestCreatedTime,
  hasCustomerRescheduleRequest,
  getCustomerRescheduleRequestedAt,
  getRequestCategoryCardClass,
  groupRequestsByCreatedDate,
  matchesRequestSearchQuery,
  sortRequestsByCreatedAt,
  subscribeToRequestChanges,
  type Request,
} from "@/lib/requests";
import { SERVICE_DISPLAY_NAME } from "@/lib/service-config";
import { shouldShowRequestOnMap } from "@/lib/request-map";
import {
  DEFAULT_SERVICE_LOCATION,
  DEFAULT_VEHICLE_CATEGORY_FILTER,
  getRequestDistanceFromService,
  hasActiveInquiryFilter,
  loadServiceLocation,
  matchesVehicleCategoryFilter,
  prepareLocationFilter,
  saveServiceLocation,
  warmCityCoordinates,
  type ServiceLocation,
  type VehicleCategoryFilter,
} from "@/lib/service-location";
import { getInquiryCategoryAvailability } from "@/lib/inquiry-packages";
import { getSupabaseErrorMessage } from "@/lib/supabase-error";
import {
  companyProfileToForm,
  companyProfileToServiceLocation,
  fetchCurrentCompanyProfile,
  type CompanyProfile,
  updateCompanyPassword,
  updateCompanyProfile,
  signOutCurrentUser,
} from "@/lib/companies";

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

const EMPTY_STATE_SEARCH: Record<SidebarState, string> = {
  inquiry: "",
  waiting: "",
  done: "",
};

const ServiceMap = dynamic(() => import("./components/service-map"), {
  ssr: false,
  loading: () => (
    <div className="casker-map-loading" aria-hidden>
      Načítavam mapu…
    </div>
  ),
});

function clampDistance(value: number) {
  return Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, value));
}

function PremiumDetailLock({
  locked,
  onActivate,
  children,
}: {
  locked: boolean;
  onActivate: () => void;
  children: ReactNode;
}) {
  if (!locked) return children;

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col blur-md pointer-events-none select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-white/45 p-6">
        <div className="max-w-md text-center">
          <p className="text-lg font-bold leading-snug text-zinc-900">
            Pre zobrazenie detailov vozidla, popisu závady a prijímanie dopytov si
            aktivujte cAsker Premium.
          </p>
          <button
            type="button"
            onClick={onActivate}
            className="mt-5 rounded-lg bg-blue-600 px-6 py-3 text-sm font-bold text-white hover:bg-blue-500"
          >
            Aktivovať Premium
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDistanceKm(value: number) {
  return value.toLocaleString("sk-SK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
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

function CancelConfirmDialog({
  isOpen,
  error,
  isSubmitting,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  error?: string | null;
  isSubmitting?: boolean;
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
        aria-labelledby="cancel-dialog-title"
        aria-describedby="cancel-dialog-desc"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="cancel-dialog-title" className="casker-dialog-title">
          Naozaj chcete odstrániť dopyt?
        </h3>
        <p id="cancel-dialog-desc" className="casker-dialog-text">
          (Zrušené dopyty nájdete v histórií dopytov)
        </p>
        {error ? <p className="casker-dialog-error">{error}</p> : null}
        <div className="casker-dialog-actions">
          <button
            type="button"
            className="casker-dialog-btn-secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Nie
          </button>
          <button
            type="button"
            className="casker-complete-btn"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Ruším…" : "Áno"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type CompleteRequestFormPayload = {
  completedWork: string;
  vehiclePickupNote: string;
};

function CompleteConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  onConfirm: (payload: CompleteRequestFormPayload) => void;
  onCancel: () => void;
}) {
  const [completedWork, setCompletedWork] = useState("");
  const [vehiclePickupNote, setVehiclePickupNote] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onCancel]);

  useEffect(() => {
    if (!isOpen) {
      setCompletedWork("");
      setVehiclePickupNote("");
    }
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") return null;

  const trimmedWork = completedWork.trim();

  return createPortal(
    <div className="casker-dialog-backdrop" onClick={onCancel}>
      <div
        className="casker-dialog casker-dialog--complete"
        role="alertdialog"
        aria-labelledby="complete-dialog-title"
        aria-describedby="complete-dialog-desc"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="complete-dialog-title" className="casker-dialog-title">
          Označiť dopyt ako Hotové?
        </h3>
        <label className="casker-dialog-field-label" htmlFor="completed-work-input">
          Vykonaná práca
        </label>
        <textarea
          id="completed-work-input"
          className="casker-dialog-textarea"
          value={completedWork}
          onChange={(event) => setCompletedWork(event.target.value)}
          placeholder="Napíšte, čo sa na vozidle robilo…"
          rows={4}
        />
        <label
          className="casker-dialog-field-label casker-dialog-field-label--spaced casker-dialog-field-label--sentence"
          htmlFor="vehicle-pickup-input"
        >
          Kedy si môže zákazník prevziať vozidlo?
        </label>
        <input
          id="vehicle-pickup-input"
          type="text"
          className="casker-dialog-input casker-dialog-input--full"
          value={vehiclePickupNote}
          onChange={(event) => setVehiclePickupNote(event.target.value)}
          placeholder="Ihneď alebo konkrétny čas"
        />
        <p id="complete-dialog-desc" className="casker-dialog-info">
          <Info className="casker-dialog-info-icon" strokeWidth={2.25} aria-hidden />
          <span>Po potvrdení sa zákazníkovi odošle notifikácia.</span>
        </p>
        <p className="casker-dialog-info">
          <Info className="casker-dialog-info-icon" strokeWidth={2.25} aria-hidden />
          <span>Hotové dopyty nájdete v História dopytov.</span>
        </p>
        <div className="casker-dialog-actions">
          <button type="button" className="casker-dialog-btn-secondary" onClick={onCancel}>
            Nie
          </button>
          <button
            type="button"
            className="casker-complete-btn"
            disabled={!trimmedWork}
            onClick={() =>
              onConfirm({
                completedWork: trimmedWork,
                vehiclePickupNote: vehiclePickupNote.trim(),
              })
            }
          >
            Áno
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SidebarRequestCard({
  request,
  activeState,
  isSelected,
  cardAppointment,
  hasRescheduleNotification,
  distanceKm,
  onSelect,
  onCancel,
}: {
  request: Request;
  activeState: SidebarState;
  isSelected: boolean;
  cardAppointment: Appointment | null;
  hasRescheduleNotification: boolean;
  distanceKm: number;
  onSelect: (id: string) => void;
  onCancel: (request: Request) => void;
}) {
  const isScheduledCard = activeState === "waiting" || activeState === "done";
  const categoryClass = getRequestCategoryCardClass(request.requestCategory);

  return (
    <div
      className={`casker-request-card-wrap${hasRescheduleNotification ? " has-reschedule-notification" : ""}`}
    >
      <button
        type="button"
        className={`casker-request-card ${isSelected ? "is-selected" : ""}${isScheduledCard ? " has-card-schedule" : ""}${categoryClass ? ` ${categoryClass}` : ""}`}
        onClick={() => onSelect(request.id)}
        aria-pressed={isSelected}
        aria-label={
          hasRescheduleNotification
            ? `${request.vehicleName} ${request.year}, zákazník žiada o zmenu termínu`
            : undefined
        }
      >
        <div className="casker-request-card-main flex w-full items-start gap-2">
          <div className="casker-card-icon">
            <RequestCardIcon
              category={request.vehicleCategory}
              requestCategory={request.requestCategory}
              request={request}
            />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <h3 className="casker-request-card-title">
              {request.vehicleName} {request.year}
            </h3>
            <p className="casker-request-service text-red-600">{request.service}</p>
          </div>
        </div>

        <div
          className={`casker-request-card-footer${isScheduledCard ? " is-scheduled" : ""}${activeState === "inquiry" ? " is-inquiry" : ""}`}
        >
          {isScheduledCard ? (
            <>
              <span className="casker-tag">EČ - {request.licensePlate}</span>
              <div className="casker-scheduled-location">
                <div className="casker-request-location-meta">
                  <div className="casker-request-distance-row">
                    <MapPin className="casker-request-location-pin h-3.5 w-3.5 shrink-0 text-[#0B194F]" />
                    <span className="casker-request-distance-km">
                      {formatDistanceKm(distanceKm)} km
                    </span>
                  </div>
                  <span className="casker-request-origin-city">{request.locationCity}</span>
                </div>
              </div>
            </>
          ) : activeState === "inquiry" ? (
            <>
              <span className="casker-tag">EČ - {request.licensePlate}</span>
              <span className="casker-request-created-time">
                {formatRequestCreatedTime(request.createdAt)}
              </span>
              <div className="casker-inquiry-location">
                <div className="casker-request-location-meta">
                  <div className="casker-request-distance-row">
                    <MapPin className="casker-request-location-pin h-3.5 w-3.5 shrink-0 text-[#0B194F]" />
                    <span className="casker-request-distance-km">
                      {formatDistanceKm(distanceKm)} km
                    </span>
                  </div>
                  <span className="casker-request-origin-city">{request.locationCity}</span>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {isScheduledCard && cardAppointment ? (
          <p
            className={`casker-request-schedule casker-request-schedule--bottom ${activeState === "done" ? "is-accepted" : ""}`}
          >
            <CalendarClock className="h-3 w-3 shrink-0" strokeWidth={2.25} />
            <span>{formatAppointmentSchedule(cardAppointment)}</span>
          </p>
        ) : null}
      </button>
      <button
        type="button"
        className="casker-request-cancel-btn"
        aria-label="Zrušiť dopyt"
        onClick={(event) => {
          event.stopPropagation();
          onCancel(request);
        }}
      >
        <X className="h-3 w-3" strokeWidth={2.5} />
      </button>
    </div>
  );
}

function InquiryDescriptionPanel({
  request,
  pendingAppointment,
  acceptedAppointment,
  proposals,
  onCustomerRescheduleRequest,
  onAppointmentUpdated,
}: {
  request: Request;
  pendingAppointment: Appointment | null;
  acceptedAppointment: Appointment | null;
  proposals: AppointmentProposal[];
  onCustomerRescheduleRequest: () => Promise<void>;
  onAppointmentUpdated: (requestId: string) => void;
}) {
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [isRequestingReschedule, setIsRequestingReschedule] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const waitingRescheduleBtnRef = useRef<HTMLButtonElement>(null);
  const respondBtnRef = useRef<HTMLButtonElement>(null);
  const isWaiting = request.status === "waiting";
  const isDone = request.status === "done";
  const isInquiry = request.status === "inquiry";
  const proposalTimeline = useMemo(() => {
    if (proposals.length > 0) return proposals;

    const fallbackAppointment =
      isWaiting && pendingAppointment
        ? pendingAppointment
        : isDone && acceptedAppointment
          ? acceptedAppointment
          : null;

    return buildInquiryProposalTimeline([], fallbackAppointment);
  }, [
    proposals,
    isWaiting,
    isDone,
    pendingAppointment,
    acceptedAppointment,
  ]);
  const rescheduleRequested = hasCustomerRescheduleRequest(
    request,
    pendingAppointment,
  );
  const rescheduleRequestedAt = getCustomerRescheduleRequestedAt(
    request,
    pendingAppointment,
  );

  const handleCustomerRescheduleRequest = async () => {
    setRescheduleError(null);
    setIsRequestingReschedule(true);
    try {
      await onCustomerRescheduleRequest();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : getSupabaseErrorMessage(error) ||
            "Žiadosť o zmenu termínu sa nepodarilo odoslať.";
      setRescheduleError(message);
    } finally {
      setIsRequestingReschedule(false);
    }
  };

  useEffect(() => {
    setBookingOpen(false);
    setRescheduleOpen(false);
  }, [request.id]);

  return (
    <div className="casker-inquiry-detail">
      <div className="casker-inquiry-chat">
        <div className="casker-inquiry-message is-customer">
          <p className="casker-inquiry-message-author">{request.userName}</p>
          <p className="casker-inquiry-message-text">{request.inquiryDescription}</p>
        </div>

        {proposalTimeline.map((proposal) => (
          <div key={proposal.id} className="casker-inquiry-proposal">
            <p className="casker-inquiry-proposal-sent-at">
              {formatProposalSentAt(proposal.sent_at)}
            </p>
            <div className="casker-inquiry-message is-service">
              <p className="casker-inquiry-message-author">
                {proposal.proposal_kind === "initial"
                  ? `Termín od ${SERVICE_DISPLAY_NAME}`
                  : "Odoslaný návrh nového termínu"}
              </p>
              <div className="casker-inquiry-message-schedule">
                <CalendarClock className="h-3 w-3 shrink-0" strokeWidth={2.25} />
                <span>{formatProposalSchedule(proposal)}</span>
              </div>
              {proposal.message ? (
                <p className="casker-inquiry-message-text">{proposal.message}</p>
              ) : null}
            </div>
          </div>
        ))}

        {isWaiting && rescheduleRequested ? (
          <div className="casker-inquiry-reschedule-notice">
            {rescheduleRequestedAt ? (
              <p className="casker-inquiry-proposal-sent-at">
                {formatProposalSentAt(rescheduleRequestedAt)}
              </p>
            ) : null}
            <div className="casker-inquiry-message is-customer is-reschedule-alert">
              <span
                className="casker-request-notification-badge"
                aria-hidden="true"
              >
                1
              </span>
              <div className="casker-inquiry-reschedule-row">
                <p className="casker-inquiry-message-text">
                  Zákazník žiada o zmenu termínu
                </p>
                <button
                  ref={waitingRescheduleBtnRef}
                  type="button"
                  className={`casker-reschedule-btn ${rescheduleOpen ? "is-open" : ""}`}
                  onClick={() => setRescheduleOpen((open) => !open)}
                  aria-expanded={rescheduleOpen}
                  aria-label="Odoslať nový termín"
                >
                  <CalendarSync className="h-5 w-5" strokeWidth={2.25} />
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {isWaiting && pendingAppointment && !rescheduleRequested ? (
          <div className="casker-inquiry-message is-customer is-customer-action">
            <p className="casker-inquiry-customer-preview-label">Náhľad pre zákazníka</p>
            <button
              type="button"
              className="casker-customer-reschedule-btn"
              onClick={() => void handleCustomerRescheduleRequest()}
              disabled={isRequestingReschedule}
            >
              {isRequestingReschedule ? "Odosielam…" : "Zažiadať iný termín"}
            </button>
            {rescheduleError ? (
              <p className="casker-inquiry-action-error" role="alert">
                {rescheduleError}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {rescheduleRequested && rescheduleError ? (
        <p className="casker-detail-error">{rescheduleError}</p>
      ) : null}

      {isInquiry ? (
        <div className="casker-inquiry-respond-row">
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
        </div>
      ) : null}

      {isInquiry ? (
        <BookingPopover
          request={request}
          anchorRef={respondBtnRef}
          isOpen={bookingOpen}
          onClose={() => setBookingOpen(false)}
          onCreated={onAppointmentUpdated}
        />
      ) : null}

      {isWaiting && rescheduleRequested ? (
        <ReschedulePopover
          request={request}
          currentAppointment={pendingAppointment}
          anchorRef={waitingRescheduleBtnRef}
          isOpen={rescheduleOpen}
          onClose={() => setRescheduleOpen(false)}
          onRescheduled={onAppointmentUpdated}
        />
      ) : null}
    </div>
  );
}

function RequestDetailPanel({
  request,
  serviceLocation,
  pendingAppointment,
  acceptedAppointment,
  proposals,
  onAppointmentCreated,
  onRequestCompleted,
  onCustomerRescheduleRequest,
}: {
  request: Request;
  serviceLocation: ServiceLocation;
  pendingAppointment: Appointment | null;
  acceptedAppointment: Appointment | null;
  proposals: AppointmentProposal[];
  onAppointmentCreated: (requestId: string) => void;
  onRequestCompleted: (requestId: string) => void;
  onCustomerRescheduleRequest: (requestId: string) => Promise<void>;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [chatPos, setChatPos] = useState({ top: 0, right: 0 });
  const chatBtnRef = useRef<HTMLButtonElement>(null);
  const rescheduleBtnRef = useRef<HTMLButtonElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const isWaiting = request.status === "waiting";
  const isDone = request.status === "done";
  const distanceFromService = getRequestDistanceFromService(request, serviceLocation);

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
    setRescheduleOpen(false);
    setCompleteDialogOpen(false);
  }, [request.id]);

  const handleConfirmComplete = async (payload: CompleteRequestFormPayload) => {
    setCompleteDialogOpen(false);
    setCompleteError(null);
    setIsCompleting(true);
    try {
      await completeRequest(request, payload);
      onRequestCompleted(request.id);
    } catch (error) {
      console.error("Nepodarilo sa dokončiť dopyt:", getSupabaseErrorMessage(error));
      setCompleteError(
        error instanceof Error
          ? error.message
          : "Dopyt sa nepodarilo označiť ako hotový. Skontrolujte oprávnenia v Supabase.",
      );
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
      <div className="casker-detail-columns-header" aria-hidden="false">
        <span className="casker-detail-columns-header-title">
          Informácie o vozidle
        </span>
        <span className="casker-detail-columns-header-title">Popis dopytu</span>
        <span className="casker-detail-columns-header-title">Užívateľ</span>
      </div>

      <div className="casker-detail-layout">
        <div className="casker-vehicle-detail">
          <div className="casker-vehicle-detail-meta">
            <span className="casker-detail-ecv">
              EČV: <strong>{request.licensePlate}</strong>
            </span>
          </div>

          <h3 className="casker-vehicle-detail-title">{request.vehicleTitle}</h3>

          <VehicleDetailSpecs
            vehicleCategory={request.vehicleCategory}
            year={request.year}
            engine={request.engine}
            power={request.power}
            fuelType={request.fuelType}
            vin={request.vin}
            mileageKm={request.mileageKm}
            transmission={request.transmission}
            drive={request.drive}
            bodyType={request.bodyType}
            doors={request.doors}
          />
        </div>

        <InquiryDescriptionPanel
          request={request}
          pendingAppointment={pendingAppointment}
          acceptedAppointment={acceptedAppointment}
          proposals={proposals}
          onCustomerRescheduleRequest={() => onCustomerRescheduleRequest(request.id)}
          onAppointmentUpdated={onAppointmentCreated}
        />

        <aside className="casker-detail-contact" aria-label="Kontakt na užívateľa">
          <div className="casker-user-info">
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
                  · {formatDistanceKm(distanceFromService)} km od servisu
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
            {request.status !== "inquiry" ? (
              <div className={`casker-detail-actions${isDone ? " is-done" : ""}`}>
                {isWaiting ? (
                  <span className="casker-waiting-status-label">
                    <CalendarClock className="h-3.5 w-3.5" strokeWidth={2.35} />
                    Termín odoslaný
                  </span>
                ) : isDone ? (
                  <>
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
                    <button
                      ref={rescheduleBtnRef}
                      type="button"
                      className={`casker-reschedule-btn ${rescheduleOpen ? "is-open" : ""}`}
                      onClick={() => {
                        setRescheduleOpen((open) => !open);
                        setCompleteDialogOpen(false);
                      }}
                      aria-expanded={rescheduleOpen}
                      aria-label="Zmena termínu"
                      title="Zmena termínu"
                    >
                      <CalendarSync className="h-5 w-5" strokeWidth={2.25} />
                    </button>
                  </>
                ) : (
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
                )}
              </div>
            ) : null}

            {completeError ? (
              <p className="casker-detail-error">{completeError}</p>
            ) : null}
          </div>

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
            onConfirm={(payload) => void handleConfirmComplete(payload)}
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
  serviceLocation: ServiceLocation;
  vehicleFilter: VehicleCategoryFilter;
  inquiryAvailability: ReturnType<typeof getInquiryCategoryAvailability>;
  top: number;
  left: number;
  panelRef: React.RefObject<HTMLDivElement | null>;
  isApplying: boolean;
  locationError: string | null;
  onRadiusChange: (value: number) => void;
  onServiceLocationChange: (location: ServiceLocation) => void;
  onVehicleFilterChange: (filter: VehicleCategoryFilter) => void;
  onApply: () => void;
};

function FilterPanel({
  radiusKm,
  serviceLocation,
  vehicleFilter,
  inquiryAvailability,
  top,
  left,
  panelRef,
  isApplying,
  locationError,
  onRadiusChange,
  onServiceLocationChange,
  onVehicleFilterChange,
  onApply,
}: FilterPanelProps) {
  const canApply = hasActiveInquiryFilter(vehicleFilter);

  return (
    <div
      ref={panelRef}
      className="casker-filter-panel"
      role="dialog"
      aria-label="Filter dopytov"
      style={{
        top,
        left,
      }}
    >
      <div className="casker-filter-section">
        <p className="casker-filter-label">Moja poloha</p>
        <AddressAutocompleteField
          location={serviceLocation}
          onLocationChange={onServiceLocationChange}
        />
        {locationError ? (
          <p className="casker-filter-error" role="alert">
            {locationError}
          </p>
        ) : null}
      </div>

      <div className="casker-filter-section">
        <p className="casker-filter-label">Typ dopytu</p>
        <div className="casker-filter-checkboxes">
          <label
            className={`casker-filter-checkbox ${!inquiryAvailability.auto ? "is-disabled" : ""}`}
          >
            <input
              type="checkbox"
              checked={vehicleFilter.car}
              disabled={!inquiryAvailability.auto}
              onChange={(event) =>
                onVehicleFilterChange({ ...vehicleFilter, car: event.target.checked })
              }
            />
            <span>Osobné autá</span>
          </label>
          <label
            className={`casker-filter-checkbox ${!inquiryAvailability.auto ? "is-disabled" : ""}`}
          >
            <input
              type="checkbox"
              checked={vehicleFilter.van}
              disabled={!inquiryAvailability.auto}
              onChange={(event) =>
                onVehicleFilterChange({ ...vehicleFilter, van: event.target.checked })
              }
            />
            <span>Úžitkové vozidlá</span>
          </label>
          <label
            className={`casker-filter-checkbox ${!inquiryAvailability.auto ? "is-disabled" : ""}`}
          >
            <input
              type="checkbox"
              checked={vehicleFilter.electric}
              disabled={!inquiryAvailability.auto}
              onChange={(event) =>
                onVehicleFilterChange({ ...vehicleFilter, electric: event.target.checked })
              }
            />
            <span>Elektromobil</span>
          </label>
          <label
            className={`casker-filter-checkbox ${!inquiryAvailability.towing ? "is-disabled" : ""}`}
          >
            <input
              type="checkbox"
              checked={vehicleFilter.towing}
              disabled={!inquiryAvailability.towing}
              onChange={(event) =>
                onVehicleFilterChange({ ...vehicleFilter, towing: event.target.checked })
              }
            />
            <span>Odťahové služby</span>
          </label>
          <label
            className={`casker-filter-checkbox ${!inquiryAvailability.tire ? "is-disabled" : ""}`}
          >
            <input
              type="checkbox"
              checked={vehicleFilter.tire}
              disabled={!inquiryAvailability.tire}
              onChange={(event) =>
                onVehicleFilterChange({ ...vehicleFilter, tire: event.target.checked })
              }
            />
            <span>Pneuservis</span>
          </label>
        </div>
      </div>

      <div className="casker-filter-section">
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
      </div>

      <button
        type="button"
        className="casker-filter-apply"
        onClick={onApply}
        disabled={!canApply || isApplying}
      >
        {isApplying ? "Počítam vzdialenosti…" : "Použiť filter"}
      </button>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [requests, setRequests] = useState<Request[]>([]);
  const [activeState, setActiveState] = useState<SidebarState>("inquiry");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );
  const [mapFocusedRequestId, setMapFocusedRequestId] = useState<string | null>(
    null,
  );
  const [viewportFocusRequestId, setViewportFocusRequestId] = useState<
    string | null
  >(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchRadius, setSearchRadius] = useState(150);
  const [appliedRadius, setAppliedRadius] = useState(150);
  const [serviceLocation, setServiceLocation] = useState<ServiceLocation>(
    DEFAULT_SERVICE_LOCATION,
  );
  const [appliedServiceLocation, setAppliedServiceLocation] =
    useState<ServiceLocation>(DEFAULT_SERVICE_LOCATION);
  const [vehicleFilter, setVehicleFilter] = useState<VehicleCategoryFilter>(
    DEFAULT_VEHICLE_CATEGORY_FILTER,
  );
  const [appliedVehicleFilter, setAppliedVehicleFilter] =
    useState<VehicleCategoryFilter>(DEFAULT_VEHICLE_CATEGORY_FILTER);
  const [locationFilterRevision, setLocationFilterRevision] = useState(0);
  const [isApplyingFilter, setIsApplyingFilter] = useState(false);
  const [filterLocationError, setFilterLocationError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [acceptedAppointments, setAcceptedAppointments] = useState<Appointment[]>(
    [],
  );
  const [pendingAppointments, setPendingAppointments] = useState<Appointment[]>(
    [],
  );
  const [appointmentProposals, setAppointmentProposals] = useState<
    AppointmentProposal[]
  >([]);
  const [cancelDialogRequestId, setCancelDialogRequestId] = useState<string | null>(
    null,
  );
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [accountForm, setAccountForm] = useState<CompanyAccountForm | null>(null);
  const [manageAccountOpen, setManageAccountOpen] = useState(false);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [stateSearchQueries, setStateSearchQueries] =
    useState<Record<SidebarState, string>>(EMPTY_STATE_SEARCH);

  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const [filterPanelPos, setFilterPanelPos] = useState({ top: 0, left: 0 });

  const updateFilterPanelPosition = useCallback(() => {
    const btn = filterBtnRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const panel = filterPanelRef.current;
    const panelWidth = panel?.offsetWidth ?? 304;
    const panelHeight = panel?.offsetHeight ?? 420;
    const gap = 10;
    const margin = 12;

    let top = rect.top;
    let left = rect.right + gap;

    if (left + panelWidth > window.innerWidth - margin) {
      left = rect.left - panelWidth - gap;
    }

    if (left < margin) {
      left = margin;
    }

    if (top + panelHeight > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - panelHeight - margin);
    }

    setFilterPanelPos({ top, left });
  }, []);

  const toggleFilter = () => {
    if (!filterOpen) updateFilterPanelPosition();
    setFilterOpen((open) => !open);
  };

  const { label: sectionLabel } = STATE_CONFIG[activeState];
  const activeSearchQuery = stateSearchQueries[activeState].trim();

  const handleRadiusChange = (raw: number) => {
    setSearchRadius(clampDistance(Number.isFinite(raw) ? raw : MAX_DISTANCE));
  };

  const pendingByRequestId = useMemo(
    () => buildPendingAppointmentMap(pendingAppointments, requests),
    [pendingAppointments, requests],
  );

  const waitingAttentionCount = useMemo(
    () =>
      requests.filter(
        (request) =>
          request.status === "waiting" &&
          hasCustomerRescheduleRequest(
            request,
            pendingByRequestId.get(request.id),
          ),
      ).length,
    [requests, pendingByRequestId],
  );

  const proposalsByRequestId = useMemo(
    () => buildProposalMap(appointmentProposals),
    [appointmentProposals],
  );

  const acceptedByRequestId = useMemo(
    () => buildAcceptedAppointmentMap(acceptedAppointments, requests),
    [acceptedAppointments, requests],
  );

  const getSearchAppointment = useCallback(
    (requestId: string) => {
      if (activeState === "waiting") {
        return pendingByRequestId.get(requestId) ?? null;
      }

      if (activeState === "done") {
        return (
          acceptedByRequestId.get(requestId) ?? pendingByRequestId.get(requestId) ?? null
        );
      }

      return null;
    },
    [activeState, acceptedByRequestId, pendingByRequestId],
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

  useEffect(() => {
    const savedLocation = loadServiceLocation();
    setServiceLocation(savedLocation);
    setAppliedServiceLocation(savedLocation);

    void fetchCurrentCompanyProfile().then((profile) => {
      if (!profile) return;

      setCompanyProfile(profile);
      setAccountForm(companyProfileToForm(profile));

      const fromCompany = companyProfileToServiceLocation(profile);
      if (fromCompany.city) {
        const location: ServiceLocation = {
          address: fromCompany.address,
          city: fromCompany.city,
          zipCode: fromCompany.zipCode,
        };
        setServiceLocation(location);
        setAppliedServiceLocation(location);
        saveServiceLocation(location);
      }
    });
  }, []);

  const handleSaveAccount = async (account: CompanyAccountForm) => {
    if (!companyProfile) return;

    const updated = await updateCompanyProfile(companyProfile.userId, account);
    setCompanyProfile(updated);
    setAccountForm(companyProfileToForm(updated));

    const fromCompany = companyProfileToServiceLocation(updated);
    if (fromCompany.city) {
      const location: ServiceLocation = {
        address: fromCompany.address,
        city: fromCompany.city,
        zipCode: fromCompany.zipCode,
      };
      setServiceLocation(location);
      setAppliedServiceLocation(location);
      saveServiceLocation(location);
    }
  };

  const handlePasswordChange = async (password: string) => {
    await updateCompanyPassword(password);
  };

  const handleLogout = async () => {
    await signOutCurrentUser();
    router.push("/auth");
    router.refresh();
  };

  const hasPremium = companyProfile?.hasPremium ?? false;
  const companyDisplayName =
    companyProfile?.companyName.trim() || SERVICE_DISPLAY_NAME;
  const inquiryAvailability = useMemo(
    () => getInquiryCategoryAvailability(companyProfile),
    [companyProfile],
  );

  useEffect(() => {
    if (requests.length === 0) return;

    void warmCityCoordinates([
      appliedServiceLocation.city,
      ...requests.map((request) => request.locationCity),
    ]).then(() => {
      setLocationFilterRevision((value) => value + 1);
    });
  }, [requests, appliedServiceLocation.city]);

  const baseFilteredRequests = useMemo(
    () =>
      sortRequestsByCreatedAt(
        requests.filter((request) => {
          if (request.status !== activeState) return false;
          if (!matchesVehicleCategoryFilter(request, appliedVehicleFilter)) {
            return false;
          }

          const distanceKm = getRequestDistanceFromService(request, appliedServiceLocation);
          return distanceKm <= appliedRadius;
        }),
      ),
    [
      requests,
      activeState,
      appliedRadius,
      appliedServiceLocation,
      appliedVehicleFilter,
      locationFilterRevision,
    ],
  );

  const filteredRequests = useMemo(
    () =>
      activeSearchQuery
        ? baseFilteredRequests.filter((request) =>
            matchesRequestSearchQuery(
              request,
              activeSearchQuery,
              getSearchAppointment(request.id),
            ),
          )
        : baseFilteredRequests,
    [activeSearchQuery, baseFilteredRequests, getSearchAppointment],
  );

  const groupedRequests = useMemo(
    () => groupRequestsByCreatedDate(filteredRequests),
    [filteredRequests],
  );

  const selectedRequest = useMemo(() => {
    if (!selectedRequestId) return null;
    const request = requests.find((r) => r.id === selectedRequestId);
    if (!request || request.status !== activeState) return null;
    if (!matchesVehicleCategoryFilter(request, appliedVehicleFilter)) {
      return null;
    }
    if (
      getRequestDistanceFromService(request, appliedServiceLocation) > appliedRadius
    ) {
      return null;
    }
    if (
      activeSearchQuery &&
      !matchesRequestSearchQuery(
        request,
        activeSearchQuery,
        getSearchAppointment(request.id),
      )
    ) {
      return null;
    }
    return request;
  }, [
    requests,
    selectedRequestId,
    activeState,
    appliedRadius,
    appliedServiceLocation,
    appliedVehicleFilter,
    activeSearchQuery,
    getSearchAppointment,
  ]);

  const handleSelectRequest = (id: string) => {
    setSelectedRequestId(id);
    const request = requests.find((item) => item.id === id);
    if (request && shouldShowRequestOnMap(request)) {
      setMapFocusedRequestId(id);
      setViewportFocusRequestId(id);
    } else {
      setMapFocusedRequestId(null);
      setViewportFocusRequestId(null);
    }
  };

  const handleMapMarkerSelect = (id: string | null) => {
    setMapFocusedRequestId(id);
    setViewportFocusRequestId(null);
    setSelectedRequestId(id);
  };

  const handleStateChange = (state: SidebarState) => {
    setActiveState(state);
    setSelectedRequestId(null);
    setMapFocusedRequestId(null);
    setViewportFocusRequestId(null);
    setFilterOpen(false);
  };

  const handleApplyFilter = async () => {
    if (!hasActiveInquiryFilter(vehicleFilter)) return;

    const nextLocation = {
      address: serviceLocation.address.trim(),
      city: serviceLocation.city.trim(),
      zipCode: serviceLocation.zipCode.trim(),
    };

    if (!nextLocation.city) {
      setFilterLocationError("Zadajte mesto prevádzky.");
      return;
    }

    setIsApplyingFilter(true);
    setFilterLocationError(null);

    const prepared = await prepareLocationFilter(
      nextLocation,
      requests.map((request) => request.locationCity),
    );

    setIsApplyingFilter(false);

    if (!prepared.ok) {
      setFilterLocationError(
        prepared.reason === "unknown-city"
          ? "Mesto sa nepodarilo nájsť. Skúste iný názov, napr. Košice alebo Snina."
          : "Zadajte mesto prevádzky.",
      );
      return;
    }

    setAppliedRadius(searchRadius);
    setAppliedServiceLocation(nextLocation);
    setAppliedVehicleFilter({ ...vehicleFilter });
    saveServiceLocation(nextLocation);
    setLocationFilterRevision((value) => value + 1);
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
      const [nextAppointments, nextPending, nextProposals] = await Promise.all([
        fetchAcceptedAppointments(),
        fetchPendingAppointments(),
        fetchAppointmentProposals(),
      ]);
      setAcceptedAppointments(nextAppointments);
      setPendingAppointments(nextPending);
      setAppointmentProposals(nextProposals);
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

    if (
      !matchedRequest ||
      matchedRequest.status === "completed" ||
      matchedRequest.status === "cancelled" ||
      matchedRequest.status === "expired"
    ) {
      return;
    }

    if (
      matchedRequest.status === "inquiry" ||
      matchedRequest.status === "waiting" ||
      matchedRequest.status === "done"
    ) {
      setActiveState(matchedRequest.status);
    }
    setSelectedRequestId(matchedRequest.id);
    if (shouldShowRequestOnMap(matchedRequest)) {
      setMapFocusedRequestId(matchedRequest.id);
      setViewportFocusRequestId(matchedRequest.id);
    } else {
      setMapFocusedRequestId(null);
      setViewportFocusRequestId(null);
    }
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

  const cancelDialogRequest = useMemo(
    () => requests.find((request) => request.id === cancelDialogRequestId) ?? null,
    [requests, cancelDialogRequestId],
  );

  const handleRequestCancelClick = (request: Request) => {
    setCancelError(null);
    setCancelDialogRequestId(request.id);
  };

  const handleCancelDialogClose = () => {
    if (isCancelling) return;
    setCancelDialogRequestId(null);
    setCancelError(null);
  };

  const handleConfirmCancel = async () => {
    if (!cancelDialogRequest) return;

    setCancelError(null);
    setIsCancelling(true);
    try {
      await cancelRequest(cancelDialogRequest);
      setRequests((current) =>
        current.filter((request) => request.id !== cancelDialogRequest.id),
      );
      if (selectedRequestId === cancelDialogRequest.id) {
        setSelectedRequestId(null);
      }
      setCancelDialogRequestId(null);
      void refreshDashboardData();
    } catch (error) {
      console.error("Nepodarilo sa zrušiť dopyt:", getSupabaseErrorMessage(error));
      setCancelError(
        error instanceof Error
          ? error.message
          : "Dopyt sa nepodarilo zrušiť. Skontrolujte migráciu supabase/add-cancelled-status.sql.",
      );
    } finally {
      setIsCancelling(false);
    }
  };

  const handleCustomerRescheduleRequest = async (requestId: string) => {
    const timestamp = await requestCustomerReschedule(requestId);
    setRequests((current) =>
      current.map((request) =>
        request.id === requestId
          ? { ...request, rescheduleRequestedAt: timestamp }
          : request,
      ),
    );
    void refreshDashboardData();
  };

  useLayoutEffect(() => {
    if (!filterOpen) return;
    updateFilterPanelPosition();
  }, [filterOpen, updateFilterPanelPosition]);

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
                const { Icon, label } = STATE_CONFIG[state];
                const isActive = activeState === state;
                const showWaitingBadge =
                  state === "waiting" && waitingAttentionCount > 0;

                return (
                  <button
                    key={state}
                    type="button"
                    className="casker-state-btn"
                    onClick={() => handleStateChange(state)}
                    aria-label={
                      showWaitingBadge
                        ? `${label}, ${waitingAttentionCount} dopytov vyžaduje pozornosť`
                        : label
                    }
                    aria-pressed={isActive}
                  >
                    {showWaitingBadge ? (
                      <span
                        className="casker-state-notification-badge"
                        aria-hidden="true"
                      >
                        {waitingAttentionCount}
                      </span>
                    ) : null}
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
                serviceLocation={serviceLocation}
                vehicleFilter={vehicleFilter}
                inquiryAvailability={inquiryAvailability}
                top={filterPanelPos.top}
                left={filterPanelPos.left}
                panelRef={filterPanelRef}
                isApplying={isApplyingFilter}
                locationError={filterLocationError}
                onRadiusChange={handleRadiusChange}
                onServiceLocationChange={(location) => {
                  setServiceLocation(location);
                  setFilterLocationError(null);
                }}
                onVehicleFilterChange={setVehicleFilter}
                onApply={() => {
                  void handleApplyFilter();
                }}
              />,
              document.body,
            )}

          <h2 className="casker-sidebar-state-title">{sectionLabel}</h2>

          <div className="casker-state-search">
            <label htmlFor={`state-search-${activeState}`} className="sr-only">
              Hľadať v stave {sectionLabel}
            </label>
            <div className="casker-state-search-field">
              <Search className="casker-state-search-icon" strokeWidth={2.25} aria-hidden />
              <input
                id={`state-search-${activeState}`}
                type="text"
                role="searchbox"
                value={stateSearchQueries[activeState]}
                onChange={(event) => {
                  const value = event.target.value;
                  setStateSearchQueries((current) => ({
                    ...current,
                    [activeState]: value,
                  }));
                }}
                placeholder="Hľadať"
                className="casker-state-search-input"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>

          <div className="casker-request-list">
            {filteredRequests.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">
                {activeSearchQuery && baseFilteredRequests.length > 0
                  ? `Nenašli sme dopyty pre „${activeSearchQuery}“`
                  : "Žiadne dopyty pre zvolený filter"}
              </p>
            ) : (
              groupedRequests.map((group) => (
                <section key={group.dateKey} className="casker-request-date-group">
                  <h3 className="casker-request-date-label">{group.label}</h3>
                  <div className="casker-request-date-cards">
                    {group.requests.map((request) => {
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
                        <SidebarRequestCard
                          key={request.id}
                          request={request}
                          activeState={activeState}
                          isSelected={isSelected}
                          cardAppointment={cardAppointment ?? null}
                          hasRescheduleNotification={
                            activeState === "waiting" &&
                            hasCustomerRescheduleRequest(
                              request,
                              pendingAppointment,
                            )
                          }
                          distanceKm={getRequestDistanceFromService(
                            request,
                            appliedServiceLocation,
                          )}
                          onSelect={handleSelectRequest}
                          onCancel={handleRequestCancelClick}
                        />
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>

        <footer className="casker-sidebar-footer">
          <span className="text-sm font-medium text-gray-600">
            {companyDisplayName}
          </span>
          <ProfileMenu
            onManageAccount={() => setManageAccountOpen(true)}
            onSubscription={() => setSubscriptionOpen(true)}
            onLogout={() => {
              void handleLogout();
            }}
          />
        </footer>
      </aside>

      <main className="casker-main">
        <MapCalendar
          isOpen={calendarOpen}
          onToggle={() => setCalendarOpen((open) => !open)}
          appointments={calendarAppointments}
          requests={requests}
          onSelectAppointment={handleAppointmentSelect}
          onRefresh={refreshDashboardData}
        >
          <section className="casker-map" aria-label="Mapa dopytov">
            <ServiceMap
              requests={filteredRequests}
              selectedRequestId={selectedRequestId}
              mapFocusedRequestId={mapFocusedRequestId}
              viewportFocusRequestId={viewportFocusRequestId}
              onMapMarkerSelect={handleMapMarkerSelect}
              serviceLocation={appliedServiceLocation}
              serviceLabel={companyDisplayName}
            />
          </section>
        </MapCalendar>

        <section className="casker-bottom-panel" aria-label="Detail dopytu">
          {selectedRequest ? (
            <PremiumDetailLock
              locked={!hasPremium}
              onActivate={() => setSubscriptionOpen(true)}
            >
              <RequestDetailPanel
                request={selectedRequest}
                serviceLocation={appliedServiceLocation}
                pendingAppointment={pendingByRequestId.get(selectedRequest.id) ?? null}
                acceptedAppointment={acceptedByRequestId.get(selectedRequest.id) ?? null}
                proposals={proposalsByRequestId.get(selectedRequest.id) ?? []}
                onAppointmentCreated={handleAppointmentCreated}
                onRequestCompleted={handleRequestCompleted}
                onCustomerRescheduleRequest={handleCustomerRescheduleRequest}
              />
            </PremiumDetailLock>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-zinc-500">
              Kliknite na dopyt v ľavom zozname pre zobrazenie detailov
            </div>
          )}
        </section>
      </main>

      <CancelConfirmDialog
        isOpen={Boolean(cancelDialogRequest)}
        error={cancelError}
        isSubmitting={isCancelling}
        onConfirm={() => {
          void handleConfirmCancel();
        }}
        onCancel={handleCancelDialogClose}
      />

      {accountForm ? (
        <ManageAccountDialog
          account={accountForm}
          isOpen={manageAccountOpen}
          onClose={() => setManageAccountOpen(false)}
          onSave={handleSaveAccount}
          onPasswordChange={(password) => {
            void handlePasswordChange(password);
          }}
        />
      ) : null}

      <SubscriptionDialog
        isOpen={subscriptionOpen}
        hasPremium={hasPremium}
        onClose={() => setSubscriptionOpen(false)}
      />
    </div>
  );
}
