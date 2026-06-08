/** Tmavšia šedá paleta pre mobilnú mapu (odvodená z dashboard štýlu). */
export const CASKER_MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#b8c4d0" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#52657a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#c8d2da" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#3d4f63" }],
  },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#c5ced6" }],
  },
  {
    featureType: "landscape.natural",
    elementType: "geometry",
    stylers: [{ color: "#b0bcc8" }],
  },
  {
    featureType: "poi",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#d8dfe6" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#9aaab8" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#c5ced6" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#8f9eac" }],
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#a8b8c6" }],
  },
] as const;
