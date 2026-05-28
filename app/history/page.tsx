"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, MapPin } from "lucide-react";
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
  fetchCompletedRequests,
  groupCompletedRequestsByDate,
  subscribeToRequestChanges,
  type CompletedRequest,
} from "@/lib/requests";
import { getSupabaseErrorMessage } from "@/lib/supabase-error";

function formatDistanceKm(value: number) {
  return value.toLocaleString("sk-SK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

export default function HistoryPage() {
  const [requests, setRequests] = useState<CompletedRequest[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const [completedRequests, acceptedAppointments] = await Promise.all([
        fetchCompletedRequests(),
        fetchAcceptedAppointments(),
      ]);

      setRequests(completedRequests);
      setAppointments(acceptedAppointments);
      setSelectedRequestId((current) => {
        if (current && completedRequests.some((request) => request.id === current)) {
          return current;
        }
        return completedRequests[0]?.id ?? null;
      });
    } catch (error) {
      setLoadError(getSupabaseErrorMessage(error));
    } finally {
      setIsLoading(false);
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

  const groupedRequests = useMemo(
    () => groupCompletedRequestsByDate(requests),
    [requests],
  );

  const appointmentByRequestId = useMemo(
    () => buildAppointmentMapByRequestId(appointments, requests),
    [appointments, requests],
  );

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) ?? null,
    [requests, selectedRequestId],
  );

  const selectedAppointment = selectedRequest
    ? appointmentByRequestId.get(selectedRequest.id) ?? null
    : null;

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

        <div className="casker-sidebar-scroll">
          <h2 className="casker-history-title">
            <Link
              href="/"
              className="casker-history-round-back"
              aria-label="Späť na dashboard"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.75} />
            </Link>
            História dopytov
          </h2>

          {isLoading ? (
            <p className="casker-history-empty">Načítavam históriu…</p>
          ) : loadError ? (
            <p className="casker-history-empty casker-history-empty--error">
              {loadError}
            </p>
          ) : groupedRequests.length === 0 ? (
            <p className="casker-history-empty">
              Zatiaľ nemáte dokončené dopyty. Po označení ako Hotové sa tu
              zobrazia.
            </p>
          ) : (
            groupedRequests.map((group) => (
              <section key={group.dateKey} className="casker-history-group">
                <h3 className="casker-history-date">{group.label}</h3>
                <div className="casker-request-list">
                  {group.requests.map((request) => {
                    const isSelected = selectedRequestId === request.id;

                    return (
                      <button
                        key={request.id}
                        type="button"
                        className={`casker-request-card ${isSelected ? "is-selected" : ""}`}
                        onClick={() => setSelectedRequestId(request.id)}
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
                  })}
                </div>
              </section>
            ))
          )}
        </div>

        <footer className="casker-sidebar-footer">
          <span className="text-sm font-medium text-gray-600">Názov servisu</span>
          <ProfileMenu />
        </footer>
      </aside>

      <main className="casker-history-main" aria-label="Detail dokončeného dopytu">
        {selectedRequest ? (
          <RequestArchiveDetail
            request={selectedRequest}
            appointment={selectedAppointment}
          />
        ) : (
          <div className="casker-history-main-empty">
            {isLoading
              ? "Načítavam detail dopytu…"
              : "Vyberte dokončený dopyt v ľavom zozname."}
          </div>
        )}
      </main>
    </div>
  );
}
