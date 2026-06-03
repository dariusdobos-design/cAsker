import type { CityCoordinates } from "./service-location";

/** Otvorí Google Maps s navigáciou z aktuálnej polohy vodiča k cieľu (mobil aj PC). */
export function buildGoogleMapsDirectionsUrl(destination: CityCoordinates) {
  const params = new URLSearchParams({
    api: "1",
    destination: `${destination.lat},${destination.lng}`,
    travelmode: "driving",
    dir_action: "navigate",
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function openGoogleMapsDirections(destination: CityCoordinates) {
  const url = buildGoogleMapsDirectionsUrl(destination);
  window.open(url, "_blank", "noopener,noreferrer");
}
