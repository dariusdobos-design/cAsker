import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { SafeAreaView } from "react-native-safe-area-context";

import { CaskerLogo } from "@/components/casker-logo";
import { DriverHomeMap, type DriverHomeMapRef } from "@/components/driver-home-map";
import { DriverRequestSheet } from "@/components/driver-request-sheet";

export default function DriverHomeScreen() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const mapRef = useRef<DriverHomeMapRef>(null);

  return (
    <View style={styles.screen}>
      <DriverHomeMap ref={mapRef} />

      <View pointerEvents="box-none" style={styles.topChrome}>
        <SafeAreaView edges={["top"]} style={styles.statusBarFill} />
        <View className="border-b border-white/10 bg-casker-navy px-4 pb-3.5 pt-2.5">
          <View className="flex-row items-center">
            <View className="w-11" />
            <View className="flex-1 items-center">
              <CaskerLogo />
            </View>
            <Pressable
              accessibilityLabel="Profil a garáž"
              accessibilityRole="button"
              onPress={() => {
                // Garáž — ďalší krok
              }}
              className="h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-casker-navy-light active:opacity-80"
            >
              <FontAwesome name="user" size={20} color="#f8fafc" />
            </Pressable>
          </View>
        </View>
      </View>

      <SafeAreaView pointerEvents="box-none" style={styles.bottomOverlay} edges={["bottom"]}>
        <View className="flex-row items-end justify-between px-4 pb-2">
          <View className="w-11" />
          <Pressable
            accessibilityLabel="Nový dopyt"
            accessibilityRole="button"
            onPress={() => setSheetOpen(true)}
            className="h-16 w-16 items-center justify-center rounded-full bg-blue-600 active:bg-blue-700"
            style={styles.fabShadow}
          >
            <FontAwesome name="plus" size={28} color="#ffffff" />
          </Pressable>
          <Pressable
            accessibilityLabel="Moja poloha"
            accessibilityRole="button"
            onPress={() => {
              void mapRef.current?.centerOnUser();
            }}
            className="h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-casker-navy/95 active:opacity-80"
            style={styles.fabShadow}
          >
            <FontAwesome name="location-arrow" size={20} color="#60a5fa" />
          </Pressable>
        </View>
      </SafeAreaView>

      <DriverRequestSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0b194f",
  },
  topChrome: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  statusBarFill: {
    backgroundColor: "#ffffff",
  },
  bottomOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  fabShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
