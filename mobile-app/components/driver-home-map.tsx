import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Dimensions,
  PixelRatio,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, type MarkerPressEvent, type Region } from "react-native-maps";
import * as Location from "expo-location";
import { ServiceMapMarker } from "@/components/service-map-marker";
import {
  PIN_CALLOUT_WIDTH,
  ServiceMapPinCallout,
} from "@/components/service-map-pin-callout";
import { useMapServices } from "@/hooks/use-map-services";
import { CASKER_MAP_STYLES } from "@/lib/casker-map-style";
import type { MapServiceMarker } from "@/lib/map-services-api";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SCREEN_WIDTH = Dimensions.get("window").width;
const PIN_CALLOUT_ESTIMATED_HEIGHT = 290;

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
  onOpenServiceProfile?: (service: MapServiceMarker) => void;
  onSendServiceInquiry?: (service: MapServiceMarker) => void;
};

export type DriverHomeMapRef = {
  centerOnUser: () => Promise<void>;
  clearServiceFocus: () => void;
};

type ScreenPoint = {
  x: number;
  y: number;
};

type MapLayout = {
  width: number;
  height: number;
};

function projectCoordinateToMapPoint(
  coordinate: { latitude: number; longitude: number },
  region: Region,
  mapLayout: MapLayout,
): ScreenPoint {
  const x =
    ((coordinate.longitude - region.longitude) / region.longitudeDelta + 0.5) * mapLayout.width;
  const y =
    ((region.latitude - coordinate.latitude) / region.latitudeDelta + 0.5) * mapLayout.height;

  return { x, y };
}

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
  { focusedService = null, mapBottomInset = 0, onOpenServiceProfile, onSendServiceInquiry },
  ref,
) {
  const mapRef = useRef<MapView>(null);
  const focusedMarkerRef = useRef<Marker>(null);
  const currentRegionRef = useRef<Region>(SLOVAKIA_REGION);
  const ignoreMapDismissUntilRef = useRef(0);
  const selectedServiceRef = useRef<MapServiceMarker | null>(null);
  const mapLayoutRef = useRef<MapLayout>({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT });

  const [locationHint, setLocationHint] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [selectedService, setSelectedService] = useState<MapServiceMarker | null>(null);
  const [cardAnchor, setCardAnchor] = useState<ScreenPoint | null>(null);
  const { services, error: servicesError } = useMapServices();

  selectedServiceRef.current = selectedService;

  const syncCardAnchor = useCallback((service: MapServiceMarker, region = currentRegionRef.current) => {
    setCardAnchor(
      projectCoordinateToMapPoint(
        { latitude: service.latitude, longitude: service.longitude },
        region,
        mapLayoutRef.current,
      ),
    );
  }, []);

  const clearSelectedService = useCallback(() => {
    setSelectedService(null);
    setCardAnchor(null);
  }, []);

  const handleMapPress = useCallback(() => {
    if (Date.now() < ignoreMapDismissUntilRef.current) {
      return;
    }

    if (selectedServiceRef.current) {
      clearSelectedService();
    }
  }, [clearSelectedService]);

  const openServiceProfile = useCallback(
    (service: MapServiceMarker) => {
      ignoreMapDismissUntilRef.current = Date.now() + 800;
      clearSelectedService();
      onOpenServiceProfile?.(service);
    },
    [clearSelectedService, onOpenServiceProfile],
  );

  const sendServiceInquiry = useCallback(
    (service: MapServiceMarker) => {
      ignoreMapDismissUntilRef.current = Date.now() + 800;
      clearSelectedService();
      onSendServiceInquiry?.(service);
    },
    [clearSelectedService, onSendServiceInquiry],
  );

  const selectService = useCallback(
    (service: MapServiceMarker, pressEvent?: MarkerPressEvent) => {
      ignoreMapDismissUntilRef.current = Date.now() + 400;

      const position = pressEvent?.nativeEvent.position;
      if (position) {
        const ratio = Platform.OS === "android" ? PixelRatio.get() : 1;
        setCardAnchor({ x: position.x / ratio, y: position.y / ratio });
      }

      setSelectedService(service);
      syncCardAnchor(service);
    },
    [syncCardAnchor],
  );

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

  const cardPosition = cardAnchor ?? {
    x: SCREEN_WIDTH / 2,
    y: SCREEN_HEIGHT * 0.42,
  };

  return (
    <View
      style={styles.root}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0) {
          mapLayoutRef.current = { width, height };
          const active = selectedServiceRef.current;
          if (active) {
            syncCardAnchor(active);
          }
        }
      }}
    >
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
        toolbarEnabled={false}
        moveOnMarkerPress={false}
        poiClickEnabled={false}
        mapType={Platform.OS === "ios" ? "mutedStandard" : "standard"}
        customMapStyle={[...CASKER_MAP_STYLES]}
        onRegionChange={(region) => {
          currentRegionRef.current = region;
          const active = selectedServiceRef.current;
          if (active) {
            syncCardAnchor(active, region);
          }
        }}
        onRegionChangeComplete={(region) => {
          currentRegionRef.current = region;
        }}
        onPress={handleMapPress}
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

              const isSelected = selectedService?.id === service.id;

              const isHighlighted =
                focusedCoordinate !== null &&
                coordinatesMatch(serviceCoordinate, focusedCoordinate);

              return (
                <ServiceMapMarker
                  key={service.id}
                  coordinate={serviceCoordinate}
                  companyName={service.companyName}
                  addressLabel={addressLabel}
                  highlighted={isHighlighted}
                  selected={isSelected}
                  nativeCallout={isHighlighted && !isSelected}
                  onPress={(event) => selectService(service, event)}
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
            />
          )
        ) : null}
      </MapView>

      {selectedService ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.cardAnchor,
            {
              left: cardPosition.x - PIN_CALLOUT_WIDTH / 2,
              top: cardPosition.y - PIN_CALLOUT_ESTIMATED_HEIGHT,
              width: PIN_CALLOUT_WIDTH,
              height: PIN_CALLOUT_ESTIMATED_HEIGHT,
            },
          ]}
        >
          <View pointerEvents="auto" style={styles.cardWrap}>
            <ServiceMapPinCallout
              service={selectedService}
              onClose={clearSelectedService}
              onOpenProfile={() => openServiceProfile(selectedService)}
              onSendInquiry={() => sendServiceInquiry(selectedService)}
            />
          </View>
        </View>
      ) : null}

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
  root: {
    flex: 1,
    overflow: "visible",
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  cardAnchor: {
    position: "absolute",
    zIndex: 20,
    elevation: 20,
    justifyContent: "flex-end",
    overflow: "visible",
  },
  cardWrap: {
    width: PIN_CALLOUT_WIDTH,
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
});
