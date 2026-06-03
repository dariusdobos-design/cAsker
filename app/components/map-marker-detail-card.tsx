import { MapPin, Navigation, X } from "lucide-react";
import { buildGoogleMapsDirectionsUrl } from "@/lib/google-maps-navigation";
import { formatRequestCategoryLabel } from "@/lib/requests";
import type { RequestMapPoint } from "@/lib/request-map";

type MapMarkerDetailCardProps = {
  point: RequestMapPoint;
  onClose?: () => void;
};

export function MapMarkerDetailCard({ point, onClose }: MapMarkerDetailCardProps) {
  const directionsUrl = buildGoogleMapsDirectionsUrl(point.position);

  return (
    <div className="casker-map-marker-card">
      {onClose ? (
        <button
          type="button"
          className="casker-map-marker-card-close"
          onClick={onClose}
          aria-label="Zavrieť"
        >
          <X aria-hidden />
        </button>
      ) : null}
      <span className="casker-map-marker-card-badge">
        {formatRequestCategoryLabel(point.requestCategory)}
      </span>
      <h3 className="casker-map-marker-card-title">
        {point.vehicleName}
        <span className="casker-map-marker-card-plate">EČ {point.licensePlate}</span>
      </h3>
      <p className="casker-map-marker-card-subtitle">{point.vehicleTitle}</p>
      <p className="casker-map-marker-card-location">
        <MapPin className="casker-map-marker-card-location-icon" aria-hidden />
        {point.locationCity}
      </p>
      <p className="casker-map-marker-card-service">{point.service}</p>
      <div className="casker-map-marker-card-fault">
        <p className="casker-map-marker-card-fault-label">Popis závady</p>
        <div className="casker-map-marker-card-fault-box">{point.inquiryDescription}</div>
      </div>
      <a
        href={directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="casker-map-navigate-btn"
      >
        <Navigation className="casker-map-navigate-btn-icon" aria-hidden />
        Navigovať
      </a>
    </div>
  );
}
