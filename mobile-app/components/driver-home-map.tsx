import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { ActivityIndicator, Dimensions, Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Callout, Marker, type Region } from "react-native-maps";
import * as Location from "expo-location";
import { ServiceMapMarker } from "@/components/service-map-marker";
import { useMapServices } from "@/hooks/use-map-services";
import { CASKER_MAP_STYLES } from "@/lib/casker-map-style";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SLOVAKIA_REGION: Region = {
  latitude: 48.716,
  longitude: 19.699,
  latitudeDelta: 5.5,
  longitudeDelta: 5.5,
};

const USER_REGION_DELTA = {
  latitudeDelta: 0.35,
  longitudeDelta: 0.35,
};

const STREET_REGION_DELTA = {
  latitudeDelta: 0.006,
  longitudeDelta: 0.006,
};

export type MapServiceFocus = {
  responseId: string;
  latitude: number;
  longitude: number;
  serviceName: string;
  serviceAddress: string;
};

type DriverHomeMapProps = {
  focusedService?: MapServiceFocus | null;
  mapBottomInset?: number;
};

export type DriverHomeMapRef = {
  centerOnUser: () => Promise<void>;
  clearServiceFocus: () => void;
};

function coordinatesMatch(
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number },
) {
  return (
    Math.abs(left.latitude - right.latitude) < 0.0025 &&
    Math.abs(left.longitude - right.longitude) < 0.0025
  );
}

export const DriverHomeMap = forwardRef<DriverHomeMapRef, DriverHomeMapProps>(function DriverHomeMap(
  { focusedService = null, mapBottomInset = 0 },
  ref,
) {
  const mapRef = useRef<MapView>(null);
  const focusedMarkerRef = useRef<Marker>(null);
  const [locationHint, setLocationHint] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const { services, error: servicesError } = useMapServices();

  const centerOnUser = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationHint("Povolenie polohy odmietnuté.");
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      mapRef.current?.animateToRegion(
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          ...USER_REGION_DELTA,
        },
        600,
      );
      setLocationHint(null);
    } catch {
      setLocationHint("Polohu sa nepodarilo načítať.");
    }
  }, []);

  const clearServiceFocus = useCallback(() => {
    focusedMarkerRef.current?.hideCallout();
  }, []);

  useImperativeHandle(ref, () => ({ centerOnUser, clearServiceFocus }), [
    centerOnUser,
    clearServiceFocus,
  ]);

  useEffect(() => {
    void centerOnUser();
  }, [centerOnUser]);

  useEffect(() => {
    if (!mapReady || !focusedService) {
      return;
    }

    const bottomInsetPx = mapBottomInset > 0 ? mapBottomInset : 0;
    const latOffset =
      STREET_REGION_DELTA.latitudeDelta * (bottomInsetPx / SCREEN_HEIGHT) * 0.7;

    mapRef.current?.animateToRegion(
      {
        latitude: focusedService.latitude - latOffset,
        longitude: focusedService.longitude,
        ...STREET_REGION_DELTA,
      },
      520,
    );

    const calloutTimer = setTimeout(() => {
      focusedMarkerRef.current?.showCallout();
    }, 560);

    return () => {
      clearTimeout(calloutTimer);
    };
  }, [focusedService, mapBottomInset, mapReady]);

  const focusedCoordinate = focusedService
    ? { latitude: focusedService.latitude, longitude: focusedService.longitude }
    : null;

  return (
    <View style={styles.fill}>
      {!mapReady ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#3d4f63" />
          <Text style={styles.loadingText}>Načítavam mapu…</Text>
        </View>
      ) : null}

      <MapView
        ref={mapRef}
        style={styles.fill}
        initialRegion={SLOVAKIA_REGION}
        onMapReady={() => setMapReady(true)}
        showsUserLocation
        showsMyLocationButton={false}
        mapType={Platform.OS === "ios" ? "mutedStandard" : "standard"}
        customMapStyle={[...CASKER_MAP_STYLES]}
      >
        {mapReady
          ? services.map((service) => {
              const addressLabel = [service.address, service.zipCode, service.city]
                .map((part) => part.trim())
                .filter(Boolean)
                .join(", ");

              const serviceCoordinate = {
                latitude: service.latitude,
                longitude: service.longitude,
              };

              const isHighlighted =
                focusedCoordinate !== null &&
                coordinatesMatch(serviceCoordinate, focusedCoordinate);

              return (
                <ServiceMapMarker
                  key={service.id}
                  ref={isHighlighted ? focusedMarkerRef : undefined}
                  coordinate={serviceCoordinate}
                  companyName={service.companyName}
                  addressLabel={addressLabel}
                  highlighted={isHighlighted}
                  callout={
                    <Callout>
                      <View style={styles.serviceCallout}>
                        <Text style={styles.serviceCalloutTitle}>{service.companyName}</Text>
                        {addressLabel ? (
                          <Text style={styles.serviceCalloutAddress}>{addressLabel}</Text>
                        ) : null}
                      </View>
                    </Callout>
                  }
                />
              );
            })
          : null}

        {mapReady && focusedCoordinate && focusedService ? (
          services.some((service) =>
            coordinatesMatch(
              { latitude: service.latitude, longitude: service.longitude },
              focusedCoordinate,
            ),
          ) ? null : (
            <ServiceMapMarker
              ref={focusedMarkerRef}
              coordinate={focusedCoordinate}
              companyName={focusedService.serviceName}
              addressLabel={focusedService.serviceAddress}
              highlighted
              callout={
                <Callout>
                  <View style={styles.serviceCallout}>
                    <Text style={styles.serviceCalloutTitle}>{focusedService.serviceName}</Text>
                    {focusedService.serviceAddress ? (
                      <Text style={styles.serviceCalloutAddress}>
                        {focusedService.serviceAddress}
                      </Text>
                    ) : null}
                  </View>
                </Callout>
              }
            />
          )
        ) : null}
      </MapView>

      {locationHint ? (
        <View style={styles.hintBanner} pointerEvents="none">
          <Text style={styles.hintText}>{locationHint}</Text>
        </View>
      ) : null}

      {servicesError ? (
        <View style={styles.errorBanner} pointerEvents="none">
          <Text style={styles.errorText}>{servicesError}</Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#b8c4d0",
    gap: 12,
  },
  loadingText: {
    color: "#52657a",
    fontSize: 14,
    fontWeight: "500",
  },
  hintBanner: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 100,
    zIndex: 2,
    borderRadius: 10,
    backgroundColor: "rgba(11, 25, 79, 0.92)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  hintText: {
    color: "#cbd5e1",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
  errorBanner: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 88,
    zIndex: 2,
    borderRadius: 10,
    backgroundColor: "rgba(220, 38, 38, 0.92)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    color: "#ffffff",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
  serviceCallout: {
    minWidth: 160,
    maxWidth: 240,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  serviceCalloutTitle: {
    color: "#0b194f",
    fontSize: 14,
    fontWeight: "700",
  },
  serviceCalloutAddress: {
    marginTop: 4,
    color: "#475569",
    fontSize: 12,
    lineHeight: 16,
  },
});
