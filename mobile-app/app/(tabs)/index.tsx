import { useCallback, useMemo, useRef, useState } from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AccountPlaceholderScreen } from "@/components/account-placeholder-screen";
import { CarWrenchIcon, MyLocationIcon } from "@/components/state-icons";
import {
  DriverHomeMap,
  type DriverHomeMapRef,
  type MapServiceFocus,
} from "@/components/driver-home-map";
import { DriverRequestSheet } from "@/components/driver-request-sheet";
import { DriverTopMenu } from "@/components/driver-top-menu";
import { DriverCalendarSheet } from "@/components/driver-calendar-sheet";
import { MenuPlaceholderScreen } from "@/components/menu-placeholder-screen";
import { MyRequestsSheet } from "@/components/my-requests-sheet";
import { buttonShadow } from "@/constants/button-shadow";
import { useDriverRequests } from "@/hooks/use-driver-requests";
import type { DriverServiceResponse } from "@/lib/driver-requests-api";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const MY_REQUESTS_MAP_INSET = SCREEN_HEIGHT * 0.52;

export default function DriverHomeScreen() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [myRequestsOpen, setMyRequestsOpen] = useState(false);
  const [garageOpen, setGarageOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [requestsRefreshKey, setRequestsRefreshKey] = useState(0);
  const [focusedService, setFocusedService] = useState<MapServiceFocus | null>(null);
  const mapRef = useRef<DriverHomeMapRef>(null);

  const {
    requests,
    isLoading: requestsLoading,
    reload: reloadRequests,
    pendingResponseCount,
  } = useDriverRequests(requestsRefreshKey);

  const handleServiceFocus = useCallback((response: DriverServiceResponse) => {
    if (response.serviceLatitude === null || response.serviceLongitude === null) {
      return;
    }

    setFocusedService({
      responseId: response.id,
      latitude: response.serviceLatitude,
      longitude: response.serviceLongitude,
      serviceName: response.serviceName,
      serviceAddress: response.serviceAddress,
    });
  }, []);

  const handleMyRequestsClose = useCallback(() => {
    setMyRequestsOpen(false);
    setFocusedService(null);
    mapRef.current?.clearServiceFocus();
  }, []);

  const mapBottomInset = useMemo(
    () => (myRequestsOpen ? MY_REQUESTS_MAP_INSET : 0),
    [myRequestsOpen],
  );

  return (
    <View style={styles.screen}>
      <DriverHomeMap
        ref={mapRef}
        focusedService={focusedService}
        mapBottomInset={mapBottomInset}
      />

      <View pointerEvents="box-none" style={styles.topChrome}>
        <SafeAreaView edges={["top"]} pointerEvents="box-none" className="px-4 pt-2">
          <View className="flex-row justify-end">
            <DriverTopMenu
              pendingCount={pendingResponseCount}
              onGarage={() => setGarageOpen(true)}
              onCalendar={() => setCalendarOpen(true)}
              onMyRequests={() => setMyRequestsOpen(true)}
              onAccount={() => setAccountOpen(true)}
            />
          </View>
        </SafeAreaView>
      </View>

      <SafeAreaView pointerEvents="box-none" style={styles.bottomOverlay} edges={["bottom"]}>
        {!myRequestsOpen ? (
          <View className="flex-row items-end justify-between px-4 pb-2">
            <View className="w-11" />
            <Pressable
              accessibilityLabel="Nový dopyt"
              accessibilityRole="button"
              onPress={() => setSheetOpen(true)}
              className="h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-white active:bg-slate-50"
              style={buttonShadow}
            >
              <CarWrenchIcon size={34} color="#0b194f" />
            </Pressable>
            <Pressable
              accessibilityLabel="Moja poloha"
              accessibilityRole="button"
              onPress={() => {
                void mapRef.current?.centerOnUser();
              }}
              className="h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white active:bg-slate-50"
              style={buttonShadow}
            >
              <MyLocationIcon size={22} color="#0b194f" />
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>

      <MyRequestsSheet
        visible={myRequestsOpen}
        onClose={handleMyRequestsClose}
        requests={requests}
        isLoading={requestsLoading}
        onReload={reloadRequests}
        activeTabPendingCount={pendingResponseCount}
        onServiceFocus={handleServiceFocus}
        focusedServiceResponseId={focusedService?.responseId ?? null}
      />

      <DriverRequestSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onRequestCreated={() => setRequestsRefreshKey((value) => value + 1)}
      />

      <MenuPlaceholderScreen
        visible={garageOpen}
        title="Garáž"
        message="Správa vozidiel v garáži pripravujeme v ďalšom kroku."
        onClose={() => setGarageOpen(false)}
      />

      <DriverCalendarSheet
        visible={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        requests={requests}
        isLoading={requestsLoading}
        onRefresh={() => {
          void reloadRequests({ silent: true });
        }}
      />

      <AccountPlaceholderScreen visible={accountOpen} onClose={() => setAccountOpen(false)} />
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
  bottomOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
});
