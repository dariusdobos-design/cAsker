"use client";

import {
  formatAppointmentDisplayDate,
  formatAppointmentDisplayTime,
  type Appointment,
} from "@/lib/appointments";
import {
  formatHistoryDateLabel,
  formatVehicleCategoryLabel,
  toHistoryDateKey,
  type CompletedRequest,
} from "@/lib/requests";

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

type RequestArchiveDetailProps = {
  request: CompletedRequest;
  appointment: Appointment | null;
};

export function RequestArchiveDetail({
  request,
  appointment,
}: RequestArchiveDetailProps) {
  const completedLabel = formatHistoryDateLabel(
    toHistoryDateKey(request.completedAt),
  );

  return (
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
            <span className="casker-archive-badge">
              Dokončené · {completedLabel}
            </span>
          </div>

          <h3 className="casker-vehicle-detail-title">{request.vehicleTitle}</h3>

          <p className="casker-archive-service">{request.service}</p>

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

          {appointment ? (
            <div className="casker-archive-work-frame">
              <p className="casker-inquiry-description-label">Vykonaná práca</p>
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

          <p className="casker-archive-readonly-note">
            Archívny záznam je iba na čítanie.
          </p>
        </aside>
      </div>
    </div>
  );
}
