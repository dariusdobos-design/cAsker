import * as Location from "expo-location";

export type ResolvedDriverLocation = {
  city: string;
  latitude: number;
  longitude: number;
};

function pickCityName(place: Location.LocationGeocodedAddress) {
  return (
    place.city?.trim() ||
    place.district?.trim() ||
    place.subregion?.trim() ||
    place.region?.trim() ||
    ""
  );
}

export async function resolveCurrentDriverLocation(): Promise<ResolvedDriverLocation> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Povolenie polohy bolo odmietnuté. Zapnite ho v nastaveniach telefónu.");
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const places = await Location.reverseGeocodeAsync({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  });

  const city = places.map(pickCityName).find((name) => name.length > 0) ?? "";

  if (!city) {
    throw new Error("Nepodarilo sa zistiť mesto z GPS. Zadajte lokalitu ručne.");
  }

  return {
    city,
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}
