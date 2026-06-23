"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  formatAppointmentDisplayDate,
  formatAppointmentDisplayTime,
  type Appointment,
} from "@/lib/appointments";
import {
  formatHistoryDateLabel,
  formatHistoryDateTimeLabel,
  getActiveStateLabel,
  isRequestNoLongerCurrentError,
  toHistoryDateKey,
  type CancelledRequest,
  type CompletedRequest,
} from "@/lib/requests";
import { VehicleDetailSpecs } from "./vehicle-detail-specs";

function formatDistanceKm(value: number) {
  return value.toLocaleString("sk-SK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

function StaleRequestDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="casker-dialog-backdrop" onClick={onClose}>
      <div
        className="casker-dialog"
        role="alertdialog"
        aria-labelledby="stale-request-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="stale-request-dialog-title" className="casker-dialog-title">
          Dopyt je už neaktuálny.
        </h3>
        <div className="casker-dialog-actions casker-dialog-actions--single">
          <button type="button" className="casker-complete-btn" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type RequestArchiveDetailProps = {
  request: CompletedRequest | CancelledRequest;
  appointment: Appointment | null;
  onRestore?: (request: CancelledRequest) => Promise<void>;
};

export function RequestArchiveDetail({
  request,
  appointment,
  onRestore,
}: RequestArchiveDetailProps) {
  const isCancelled = request.status === "cancelled";
  const archivedAt = isCancelled
    ? (request as CancelledRequest).cancelledAt
    : (request as CompletedRequest).completedAt;
  const archivedLabel = isCancelled
    ? formatHistoryDateTimeLabel(archivedAt)
    : formatHistoryDateLabel(toHistoryDateKey(archivedAt));
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [staleDialogOpen, setStaleDialogOpen] = useState(false);

  const handleRestore = async () => {
    if (!onRestore || !isCancelled) return;

    setRestoreError(null);
    setIsRestoring(true);
    try {
      await onRestore(request as CancelledRequest);
    } catch (error) {
      if (isRequestNoLongerCurrentError(error)) {
        setStaleDialogOpen(true);
        return;
      }

      setRestoreError(
        error instanceof Error
          ? error.message
          : "Dopyt sa nepodarilo obnoviť.",
      );
    } finally {
      setIsRestoring(false);
    }
  };

  const restoreTargetLabel = isCancelled
    ? getActiveStateLabel(
        (request as CancelledRequest).statusBeforeCancel ?? "inquiry",
      )
    : null;

  return (
    <>
      <div className="casker-bottom-panel-inner casker-archive-detail">
        <div className="casker-detail-top-actions">
          <span className="casker-detail-ecv">
            EČV: <strong>{request.licensePlate}</strong>
          </span>
        </div>

        <div className="casker-detail-layout">
          <div className="casker-vehicle-detail">
            <div className="casker-vehicle-detail-header casker-archive-detail-header">
              <span className="casker-vehicle-detail-label">
                Informácie o vozidle
              </span>
              <span
                className={`casker-archive-badge ${isCancelled ? "is-cancelled" : ""}`}
              >
                {isCancelled ? "Zrušené" : "Dokončené"} · {archivedLabel}
              </span>
            </div>

            <h3 className="casker-vehicle-detail-title">{request.vehicleTitle}</h3>

            <p className="casker-archive-service">{request.service}</p>

            <VehicleDetailSpecs
              vehicleCategory={request.vehicleCategory}
              year={request.year}
              engine={request.engine}
              engineVolume={request.engineVolume}
              vehicleName={request.vehicleName}
              power={request.power}
              fuelType={request.fuelType}
              vin={request.vin}
              mileageKm={request.mileageKm}
              transmission={request.transmission}
              drive={request.drive}
              bodyType={request.bodyType}
              doors={request.doors}
            />

            <div className="casker-inquiry-frame">
              <p className="casker-inquiry-description-label">Popis dopytu:</p>
              <p className="casker-inquiry-description-text">
                {request.inquiryDescription}
              </p>
            </div>

            {appointment || request.completedWork || request.vehiclePickupNote ? (
              <div className="casker-archive-work-frame">
                <p className="casker-inquiry-description-label">
                  {isCancelled ? "Posledný termín" : "Vykonaná práca"}
                </p>
                {request.completedWork ? (
                  <p className="casker-sent-message-text">{request.completedWork}</p>
                ) : null}
                {request.vehiclePickupNote ? (
                  <>
                    <p className="casker-inquiry-description-label casker-archive-pickup-label">
                      Prevzatie vozidla
                    </p>
                    <p className="casker-sent-message-text">{request.vehiclePickupNote}</p>
                  </>
                ) : null}
                {appointment ? (
                  <>
                    <div className="casker-archive-work-grid">
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
                    </div>
                    {appointment.message ? (
                      <div className="casker-sent-message-frame">
                        <p className="casker-sent-message-label">Správa zo servisu</p>
                        <p className="casker-sent-message-text">{appointment.message}</p>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}
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

            {isCancelled && onRestore ? (
              <div className="casker-archive-restore">
                <button
                  type="button"
                  className="casker-restore-btn"
                  onClick={() => {
                    void handleRestore();
                  }}
                  disabled={isRestoring}
                >
                  {isRestoring ? "Obnovujem…" : "Obnoviť dopyt"}
                </button>
                {restoreTargetLabel ? (
                  <p className="casker-archive-restore-note">
                    Dopyt sa vráti do stavu {restoreTargetLabel}.
                  </p>
                ) : null}
                {restoreError ? (
                  <p className="casker-archive-restore-error">{restoreError}</p>
                ) : null}
              </div>
            ) : (
              <p className="casker-archive-readonly-note">
                Archívny záznam je iba na čítanie.
              </p>
            )}
          </aside>
        </div>
      </div>

      <StaleRequestDialog
        isOpen={staleDialogOpen}
        onClose={() => setStaleDialogOpen(false)}
      />
    </>
  );
}
