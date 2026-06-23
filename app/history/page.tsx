"use client";

import "./history-tabs.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, MapPin, Search, XCircle } from "lucide-react";
import { ProfileMenu } from "../components/profile-menu";
import { RequestArchiveDetail } from "../components/request-archive-detail";
import { RequestCardIcon } from "../components/request-card-icon";
import { CarWrenchIcon } from "../state-icons";
import {
  buildAppointmentMapByRequestId,
  fetchAcceptedAppointments,
  type Appointment,
} from "@/lib/appointments";
import {
  getInquiryUserDescription,
  truncateInquiryCardDescription,
} from "@/lib/inquiry-description";
import {
  fetchCompletedRequests,
  fetchCancelledRequests,
  getRequestCategoryCardClass,
  groupCancelledRequestsByDate,
  groupCompletedRequestsByDate,
  matchesRequestSearchQuery,
  restoreRequest,
  subscribeToRequestChanges,
  type CancelledRequest,
  type CompletedRequest,
} from "@/lib/requests";
import { getSupabaseErrorMessage } from "@/lib/supabase-error";

type HistoryTab = "completed" | "cancelled";

const EMPTY_HISTORY_SEARCH: Record<HistoryTab, string> = {
  completed: "",
  cancelled: "",
};

function formatDistanceKm(value: number) {
  return value.toLocaleString("sk-SK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<HistoryTab>("completed");
  const [completedRequests, setCompletedRequests] = useState<CompletedRequest[]>([]);
  const [cancelledRequests, setCancelledRequests] = useState<CancelledRequest[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [historySearchQueries, setHistorySearchQueries] =
    useState<Record<HistoryTab, string>>(EMPTY_HISTORY_SEARCH);

  const activeRequests =
    activeTab === "completed" ? completedRequests : cancelledRequests;
  const activeSearchQuery = historySearchQueries[activeTab].trim();

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const [completed, cancelled, acceptedAppointments] = await Promise.all([
        fetchCompletedRequests(),
        fetchCancelledRequests(),
        fetchAcceptedAppointments(),
      ]);

      setCompletedRequests(completed);
      setCancelledRequests(cancelled);
      setAppointments(acceptedAppointments);
    } catch (error) {
      setLoadError(getSupabaseErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshCancelledRequests = useCallback(async () => {
    try {
      const cancelled = await fetchCancelledRequests();
      setCancelledRequests(cancelled);
      setSelectedRequestId((current) => {
        if (current && cancelled.some((request) => request.id === current)) {
          return current;
        }
        return cancelled[0]?.id ?? null;
      });
    } catch (error) {
      console.warn(
        "Synchronizácia zrušených dopytov zlyhala:",
        getSupabaseErrorMessage(error),
      );
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const handleFocus = () => {
      void loadHistory();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadHistory]);

  useEffect(() => {
    return subscribeToRequestChanges(() => {
      void loadHistory();
    });
  }, [loadHistory]);

  useEffect(() => {
    if (activeTab !== "cancelled") return;
    void refreshCancelledRequests();
  }, [activeTab, refreshCancelledRequests]);

  const appointmentByRequestId = useMemo(
    () => buildAppointmentMapByRequestId(appointments, activeRequests),
    [appointments, activeRequests],
  );

  const filteredActiveRequests = useMemo(() => {
    if (!activeSearchQuery) return activeRequests;

    return activeRequests.filter((request) =>
      matchesRequestSearchQuery(
        request,
        activeSearchQuery,
        appointmentByRequestId.get(request.id),
      ),
    );
  }, [activeRequests, activeSearchQuery, appointmentByRequestId]);

  const groupedRequests = useMemo(() => {
    if (activeTab === "completed") {
      return groupCompletedRequestsByDate(filteredActiveRequests as CompletedRequest[]);
    }
    return groupCancelledRequestsByDate(filteredActiveRequests as CancelledRequest[]);
  }, [activeTab, filteredActiveRequests]);

  useEffect(() => {
    setSelectedRequestId((current) => {
      if (current && filteredActiveRequests.some((request) => request.id === current)) {
        return current;
      }
      return filteredActiveRequests[0]?.id ?? null;
    });
  }, [filteredActiveRequests, activeTab]);

  const selectedRequest = useMemo(
    () => filteredActiveRequests.find((request) => request.id === selectedRequestId) ?? null,
    [filteredActiveRequests, selectedRequestId],
  );

  const selectedAppointment = selectedRequest
    ? appointmentByRequestId.get(selectedRequest.id) ?? null
    : null;

  const handleRestoreRequest = async (request: CancelledRequest) => {
    await restoreRequest(request);
    setCancelledRequests((current) =>
      current.filter((entry) => entry.id !== request.id),
    );
    setSelectedRequestId(null);
    void loadHistory();
  };

  const emptyMessage =
    activeTab === "completed"
      ? "Zatiaľ nemáte dokončené dopyty. Po označení ako Hotové sa tu zobrazia."
      : "Zatiaľ nemáte zrušené dopyty. Po zrušení dopytu sa tu zobrazia.";

  const mainEmptyMessage =
    activeTab === "completed"
      ? "Vyberte dokončený dopyt v ľavom zozname."
      : "Vyberte zrušený dopyt v ľavom zozname.";

  return (
    <div className="casker-dashboard casker-history-page font-sans">
      <aside className="casker-sidebar">
        <header className="casker-sidebar-header">
          <Link href="/" className="casker-logo" aria-label="cAsker">
            <span className="casker-logo-text">c</span>
            <CarWrenchIcon className="casker-logo-icon" />
            <span className="casker-logo-text">sker</span>
          </Link>
        </header>

        <div className="casker-history-sidebar-body">
          <div className="casker-history-sidebar-head">
            <div className="casker-history-back-row">
              <Link
                href="/"
                className="casker-history-round-back"
                aria-label="Späť na dashboard"
              >
                <ChevronLeft className="h-5 w-5" strokeWidth={2.75} />
              </Link>
            </div>

            <div className="casker-history-pills" role="tablist" aria-label="Typ histórie">
              <button
                type="button"
                role="tab"
                className={`casker-history-pill ${activeTab === "completed" ? "is-active" : "is-inactive"}`}
                aria-label="Hotové"
                aria-selected={activeTab === "completed"}
                onClick={() => setActiveTab("completed")}
              >
                <CheckCircle2 strokeWidth={2.25} />
                <span>Hotové</span>
              </button>
              <button
                type="button"
                role="tab"
                className={`casker-history-pill ${activeTab === "cancelled" ? "is-active" : "is-inactive"}`}
                aria-label="Zrušené"
                aria-selected={activeTab === "cancelled"}
                onClick={() => setActiveTab("cancelled")}
              >
                <XCircle strokeWidth={2.25} />
                <span>Zrušené</span>
              </button>
            </div>

            <h2 className="casker-history-title">História dopytov</h2>

            <div className="casker-state-search">
              <label htmlFor={`history-search-${activeTab}`} className="sr-only">
                Hľadať v histórii dopytov
              </label>
              <div className="casker-state-search-field">
                <Search className="casker-state-search-icon" strokeWidth={2.25} aria-hidden />
                <input
                  id={`history-search-${activeTab}`}
                  type="text"
                  role="searchbox"
                  value={historySearchQueries[activeTab]}
                  onChange={(event) => {
                    const value = event.target.value;
                    setHistorySearchQueries((current) => ({
                      ...current,
                      [activeTab]: value,
                    }));
                  }}
                  placeholder="Hľadať"
                  className="casker-state-search-input"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>
          </div>

          <div className="casker-sidebar-scroll casker-history-sidebar-scroll">
            {isLoading ? (
              <p className="casker-history-empty">Načítavam históriu…</p>
            ) : loadError ? (
              <p className="casker-history-empty casker-history-empty--error">
                {loadError}
              </p>
            ) : groupedRequests.length === 0 ? (
              <p className="casker-history-empty">
                {activeSearchQuery && activeRequests.length > 0
                  ? `Nenašli sme dopyty pre „${activeSearchQuery}“`
                  : emptyMessage}
              </p>
            ) : (
              groupedRequests.map((group) => (
                <section key={group.dateKey} className="casker-history-group">
                  <h3 className="casker-history-date">{group.label}</h3>
                  <div className="casker-request-list">
                    {group.requests.map((request) => {
                      const isSelected = selectedRequestId === request.id;
                      const categoryClass = getRequestCategoryCardClass(
                        request.requestCategory,
                      );
                      const cardDescription = truncateInquiryCardDescription(
                        getInquiryUserDescription(request.inquiryDescription),
                      );

                      return (
                        <button
                          key={request.id}
                          type="button"
                          className={`casker-request-card ${isSelected ? "is-selected" : ""}${categoryClass ? ` ${categoryClass}` : ""}`}
                          onClick={() => setSelectedRequestId(request.id)}
                          aria-pressed={isSelected}
                        >
                          <div className="flex w-full items-start gap-2">
                            <div className="casker-card-icon">
                              <RequestCardIcon
                                category={request.vehicleCategory}
                                requestCategory={request.requestCategory}
                                request={request}
                              />
                            </div>
                            <div className="min-w-0 flex-1 overflow-hidden">
                              <h3 className="text-base font-bold leading-tight text-white">
                                {request.vehicleName} {request.year}
                              </h3>
                              {cardDescription ? (
                                <p className="casker-request-service text-red-600">
                                  {cardDescription}
                                </p>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="casker-tag">
                              EČ - {request.licensePlate}
                            </span>
                            <div className="flex shrink-0 items-center gap-1 text-xs font-medium text-white">
                              <MapPin className="h-3.5 w-3.5 text-white" />
                              <span>{formatDistanceKm(request.distanceKm)} km</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>

        <footer className="casker-sidebar-footer">
          <span className="text-sm font-medium text-gray-600">Názov servisu</span>
          <ProfileMenu />
        </footer>
      </aside>

      <main
        className="casker-history-main"
        aria-label={
          activeTab === "completed" ? "Detail dokončeného dopytu" : "Detail zrušeného dopytu"
        }
      >
        {selectedRequest ? (
          <RequestArchiveDetail
            request={selectedRequest}
            appointment={selectedAppointment}
            onRestore={
              activeTab === "cancelled" ? handleRestoreRequest : undefined
            }
          />
        ) : (
          <div className="casker-history-main-empty">
            {isLoading ? "Načítavam detail dopytu…" : mainEmptyMessage}
          </div>
        )}
      </main>
    </div>
  );
}
