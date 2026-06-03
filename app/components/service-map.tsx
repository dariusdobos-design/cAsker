"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  APIProvider,
  ColorScheme,
  InfoWindow,
  Map,
  Marker,
  useApiIsLoaded,
  useMap,
} from "@vis.gl/react-google-maps";
import { MapMarkerDetailCard } from "./map-marker-detail-card";
import {
  buildRequestMapPoints,
  type MapEligibleRequest,
  type RequestMapPoint,
} from "@/lib/request-map";
import {
  resolveCityCoordinatesSync,
  resolveServiceCoordinatesAsync,
  resolveServiceCoordinatesSync,
  type CityCoordinates,
  type ServiceLocation,
} from "@/lib/service-location";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const DEFAULT_CENTER = { lat: 49.22, lng: 18.74 };
const DEFAULT_ZOOM = 9;
const SIDEBAR_FOCUS_ZOOM = 12;
const SERVICE_FOCUS_ZOOM = 15;
const SERVICE_PIN_ICON = "/icons/service-pin.svg";

const CASKER_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#d2dce6" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#627d98" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#e8eef3" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#475569" }],
  },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#e8eef3" }],
  },
  {
    featureType: "landscape.natural",
    elementType: "geometry",
    stylers: [{ color: "#d9e2eb" }],
  },
  {
    featureType: "poi",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#eef2f6" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#b8c4d0" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#e8eef3" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#becbd7" }],
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#c2ced9" }],
  },
];

export type ServiceMapProps = {
  requests: MapEligibleRequest[];
  selectedRequestId: string | null;
  mapFocusedRequestId: string | null;
  viewportFocusRequestId: string | null;
  onMapMarkerSelect: (requestId: string | null) => void;
  serviceLocation: ServiceLocation;
  serviceLabel?: string;
};

function MapViewportController({
  focusPointId,
  focusZoom,
  mapPoints,
  servicePosition,
  locateNonce,
}: {
  focusPointId: string | null;
  focusZoom: number | null;
  mapPoints: RequestMapPoint[];
  servicePosition: CityCoordinates | null;
  locateNonce: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || locateNonce === 0 || !servicePosition) return;

    map.panTo(servicePosition);
    map.setZoom(SERVICE_FOCUS_ZOOM);
  }, [locateNonce, map, servicePosition]);

  useEffect(() => {
    if (!map || !focusPointId || focusZoom == null) return;

    const focusPoint = mapPoints.find((point) => point.id === focusPointId);
    if (!focusPoint) return;

    map.panTo(focusPoint.position);
    map.setZoom(focusZoom);
  }, [focusPointId, focusZoom, map, mapPoints]);

  return null;
}

function useServiceMapPosition(serviceLocation: ServiceLocation) {
  const [position, setPosition] = useState<CityCoordinates | null>(() =>
    resolveServiceCoordinatesSync(serviceLocation),
  );

  useEffect(() => {
    const syncPosition = resolveServiceCoordinatesSync(serviceLocation);
    if (syncPosition) setPosition(syncPosition);

    let cancelled = false;
    void resolveServiceCoordinatesAsync(serviceLocation).then((resolved) => {
      if (!cancelled && resolved) setPosition(resolved);
    });

    return () => {
      cancelled = true;
    };
  }, [serviceLocation]);

  return position;
}

function LocateMeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3.25" fill="currentColor" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        d="M12 2v4M12 18v4M2 12h4M18 12h4"
      />
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function ServiceMapContent({
  requests,
  selectedRequestId,
  mapFocusedRequestId,
  viewportFocusRequestId,
  onMapMarkerSelect,
  serviceLocation,
  serviceLabel = "Moja prevádzka",
}: ServiceMapProps) {
  const isApiLoaded = useApiIsLoaded();
  const [locateNonce, setLocateNonce] = useState(0);
  const servicePosition = useServiceMapPosition(serviceLocation);
  const mapPoints = useMemo(() => buildRequestMapPoints(requests), [requests]);

  const popupPoint = useMemo(() => {
    if (!mapFocusedRequestId) return null;
    return mapPoints.find((point) => point.id === mapFocusedRequestId) ?? null;
  }, [mapFocusedRequestId, mapPoints]);

  const defaultCenter = useMemo(() => {
    return servicePosition ?? resolveCityCoordinatesSync(serviceLocation.city) ?? DEFAULT_CENTER;
  }, [serviceLocation.city, servicePosition]);

  const mapFocus = useMemo(() => {
    if (viewportFocusRequestId) {
      return { pointId: viewportFocusRequestId, zoom: SIDEBAR_FOCUS_ZOOM };
    }

    return { pointId: null, zoom: null };
  }, [viewportFocusRequestId]);

  const getMarkerIcon = (isSelected: boolean, isEmergency: boolean) => {
    if (!isApiLoaded || typeof google === "undefined") return undefined;

    if (isSelected) {
      return {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 11,
        fillColor: "#2563eb",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      };
    }

    if (isEmergency) {
      return {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: "#dc2626",
        fillOpacity: 0.95,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      };
    }

    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: "#0b194f",
      fillOpacity: 0.92,
      strokeColor: "#ffffff",
      strokeWeight: 2,
    };
  };

  const getServiceMarkerIcon = useCallback(() => {
    if (!isApiLoaded || typeof google === "undefined") return undefined;

    return {
      url: SERVICE_PIN_ICON,
      scaledSize: new google.maps.Size(36, 43),
      anchor: new google.maps.Point(18, 43),
    };
  }, [isApiLoaded]);

  const handleLocateService = () => {
    if (!servicePosition) return;
    setLocateNonce((value) => value + 1);
  };

  return (
    <div className="casker-map-shell">
      <Map
        className="casker-google-map"
        defaultCenter={defaultCenter}
        defaultZoom={DEFAULT_ZOOM}
        colorScheme={ColorScheme.LIGHT}
        styles={CASKER_MAP_STYLES}
        gestureHandling="greedy"
        disableDefaultUI
        zoomControl
        fullscreenControl={false}
        mapTypeControl={false}
        streetViewControl={false}
        onClick={() => onMapMarkerSelect(null)}
      >
        <MapViewportController
          focusPointId={mapFocus.pointId}
          focusZoom={mapFocus.zoom}
          mapPoints={mapPoints}
          servicePosition={servicePosition}
          locateNonce={locateNonce}
        />

        {servicePosition ? (
          <Marker
            position={servicePosition}
            title={serviceLabel}
            zIndex={2000}
            icon={getServiceMarkerIcon()}
          />
        ) : null}

        {mapPoints.map((point) => {
          const isSelected = point.id === mapFocusedRequestId;

          return (
            <Marker
              key={point.id}
              position={point.position}
              title={point.title}
              zIndex={isSelected ? 1000 : point.isEmergency ? 100 : 1}
              icon={getMarkerIcon(isSelected, point.isEmergency)}
              onClick={(event) => {
                event.domEvent?.stopPropagation?.();
                onMapMarkerSelect(point.id);
              }}
            />
          );
        })}

        {popupPoint ? (
          <InfoWindow
            key={popupPoint.id}
            position={popupPoint.position}
            pixelOffset={[0, -6]}
            maxWidth={340}
            disableAutoPan
            onCloseClick={() => onMapMarkerSelect(null)}
          >
            <MapMarkerDetailCard
              point={popupPoint}
              onClose={() => onMapMarkerSelect(null)}
            />
          </InfoWindow>
        ) : null}
      </Map>

      <button
        type="button"
        className="casker-map-locate-btn"
        onClick={handleLocateService}
        disabled={!servicePosition}
        aria-label="Priblížiť na moju polohu"
        title="Moja poloha"
      >
        <LocateMeIcon />
        <span>Moja poloha</span>
      </button>
    </div>
  );
}

export default function ServiceMap(props: ServiceMapProps) {
  if (!API_KEY) {
    return (
      <div className="casker-map-loading">
        Chýba NEXT_PUBLIC_GOOGLE_MAPS_API_KEY v .env.local
      </div>
    );
  }

  return (
    <APIProvider apiKey={API_KEY}>
      <ServiceMapContent {...props} />
    </APIProvider>
  );
}
