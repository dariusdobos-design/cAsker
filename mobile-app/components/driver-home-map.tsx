import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import MapView, { type Region } from "react-native-maps";
import * as Location from "expo-location";

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

export type DriverHomeMapRef = {
  centerOnUser: () => Promise<void>;
};

export const DriverHomeMap = forwardRef<DriverHomeMapRef>(function DriverHomeMap(
  _props,
  ref,
) {
  const mapRef = useRef<MapView>(null);
  const [locationHint, setLocationHint] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

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

  useImperativeHandle(ref, () => ({ centerOnUser }), [centerOnUser]);

  useEffect(() => {
    void centerOnUser();
  }, [centerOnUser]);

  return (
    <View style={styles.fill}>
      {!mapReady ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#60a5fa" />
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
        mapType="standard"
      />

      {locationHint ? (
        <View style={styles.hintBanner} pointerEvents="none">
          <Text style={styles.hintText}>{locationHint}</Text>
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
    backgroundColor: "#1e293b",
    gap: 12,
  },
  loadingText: {
    color: "#94a3b8",
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
});
