import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DriverRequestThread } from "@/components/driver-request-thread";
import { RequestChatSheet } from "@/components/request-chat-sheet";
import { NotificationBadge } from "@/components/notification-badge";
import {
  cancelDriverRequest,
  confirmDriverVehiclePickup,
  isActiveDriverRequest,
  isHistoryDriverRequest,
  isReceivedDriverRequest,
  type DriverRequestSummary,
  type DriverServiceResponse,
} from "@/lib/driver-requests-api";
import { groupDriverHistoryRequests } from "@/lib/driver-history";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SNAP_FULL = SCREEN_HEIGHT * 0.08;
const HALF_HEIGHT = SCREEN_HEIGHT * 0.5;
const FULL_HEIGHT = SCREEN_HEIGHT - SNAP_FULL;
const EXPAND_HEIGHT_THRESHOLD = HALF_HEIGHT + (FULL_HEIGHT - HALF_HEIGHT) * 0.35;
const DISMISS_DRAG_PX = 90;
const DISMISS_VELOCITY = 700;
const SHEET_CLOSE_MS = 260;
const SHEET_OPEN_MS = 320;
const SHEET_SETTLE_MS = 220;

function snapSheetTo(target: number) {
  "worklet";
  return withTiming(target, {
    duration: SHEET_SETTLE_MS,
    easing: Easing.out(Easing.cubic),
  });
}

type MyRequestsTab = "active" | "received" | "history";

type MyRequestsSheetProps = {
  visible: boolean;
  onClose: () => void;
  requests: DriverRequestSummary[];
  isLoading: boolean;
  onReload: (options?: { silent?: boolean }) => Promise<void>;
  activeTabPendingCount?: number;
  receivedTabPendingCount?: number;
  historyTabPendingCount?: number;
  hasUnseenHistoryNotification?: (request: DriverRequestSummary) => boolean;
  onAcknowledgeHistoryNotification?: (requestId: string) => void;
  onServiceFocus?: (response: DriverServiceResponse) => void;
  focusedServiceResponseId?: string | null;
};

export function MyRequestsSheet({
  visible,
  onClose,
  requests,
  isLoading,
  onReload,
  activeTabPendingCount = 0,
  receivedTabPendingCount = 0,
  historyTabPendingCount = 0,
  hasUnseenHistoryNotification,
  onAcknowledgeHistoryNotification,
  onServiceFocus,
  focusedServiceResponseId = null,
}: MyRequestsSheetProps) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<MyRequestsTab>("active");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyResponseId, setBusyResponseId] = useState<string | null>(null);
  const [chatRequest, setChatRequest] = useState<DriverRequestSummary | null>(null);
  const [chatServiceName, setChatServiceName] = useState("Servis");

  const sheetHeight = useSharedValue(HALF_HEIGHT);
  const translateY = useSharedValue(HALF_HEIGHT);
  const scrollY = useSharedValue(0);
  const isClosing = useSharedValue(false);
  const dragStartY = useSharedValue(0);
  const dragStartHeight = useSharedValue(HALF_HEIGHT);

  const activeRequests = useMemo(
    () => requests.filter((request) => isActiveDriverRequest(request.status)),
    [requests],
  );

  const receivedRequests = useMemo(
    () => requests.filter((request) => isReceivedDriverRequest(request)),
    [requests],
  );

  const historyRequests = useMemo(
    () => requests.filter((request) => isHistoryDriverRequest(request)),
    [requests],
  );

  const groupedHistoryRequests = useMemo(
    () => groupDriverHistoryRequests(historyRequests),
    [historyRequests],
  );

  const visibleRequests =
    tab === "active"
      ? activeRequests
      : tab === "received"
        ? receivedRequests
        : historyRequests;

  const finishClose = useCallback(() => {
    isClosing.value = false;
    onClose();
  }, [isClosing, onClose]);

  const animateClose = useCallback(() => {
    if (isClosing.value) {
      return;
    }

    isClosing.value = true;
    translateY.value = withTiming(
      sheetHeight.value,
      { duration: SHEET_CLOSE_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(finishClose)();
        } else {
          isClosing.value = false;
        }
      },
    );
  }, [finishClose, isClosing, sheetHeight, translateY]);

  useLayoutEffect(() => {
    if (!visible) {
      return;
    }
    isClosing.value = false;
    scrollY.value = 0;
    sheetHeight.value = HALF_HEIGHT;
    translateY.value = HALF_HEIGHT;
    translateY.value = withTiming(0, {
      duration: SHEET_OPEN_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [visible, isClosing, scrollY, sheetHeight, translateY]);

  const handleCloseChat = useCallback(() => {
    setChatRequest(null);
  }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const onBackPress = () => {
      if (chatRequest !== null) {
        handleCloseChat();
        return true;
      }

      animateClose();
      return true;
    };

    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => subscription.remove();
  }, [visible, chatRequest, animateClose, handleCloseChat]);

  const handleChatRead = useCallback(() => {
    void onReload({ silent: true });
  }, [onReload]);

  const handleOpenChat = useCallback((request: DriverRequestSummary, serviceName: string) => {
    setChatRequest(request);
    setChatServiceName(serviceName);
  }, []);

  const handleCancelPress = useCallback(
    (request: DriverRequestSummary) => {
      Alert.alert("Zrušiť dopyt", "Naozaj chcete zrušiť dopyt?", [
        { text: "Nie", style: "cancel" },
        {
          text: "Áno",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setCancellingId(request.id);
              try {
                await cancelDriverRequest(request.id);
                await onReload({ silent: true });
              } catch (cancelError) {
                const message =
                  cancelError instanceof Error
                    ? cancelError.message
                    : "Dopyt sa nepodarilo zrušiť.";
                Alert.alert("Chyba", message);
              } finally {
                setCancellingId(null);
              }
            })();
          },
        },
      ]);
    },
    [onReload],
  );

  const handleConfirmPickupPress = useCallback(
    (request: DriverRequestSummary) => {
      Alert.alert("Prevzali ste vozidlo?", "Presunie sa do História", [
        { text: "Zrušiť", style: "cancel" },
        {
          text: "Potvrdiť",
          onPress: () => {
            void (async () => {
              setConfirmingId(request.id);
              try {
                await confirmDriverVehiclePickup(request.id);
                await onReload({ silent: true });
                setTab("history");
              } catch (confirmError) {
                const message =
                  confirmError instanceof Error
                    ? confirmError.message
                    : "Prevzatie vozidla sa nepodarilo potvrdiť.";
                Alert.alert("Chyba", message);
              } finally {
                setConfirmingId(null);
              }
            })();
          },
        },
      ]);
    },
    [onReload],
  );

  const handlePanGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-6, 6])
        .failOffsetX([-20, 20])
        .onBegin(() => {
          dragStartY.value = translateY.value;
          dragStartHeight.value = sheetHeight.value;
        })
        .onUpdate((event) => {
          const dy = event.translationY;

          if (dy >= 0) {
            translateY.value = Math.min(dragStartY.value + dy, sheetHeight.value);
            return;
          }

          translateY.value = 0;
          sheetHeight.value = Math.min(FULL_HEIGHT, Math.max(HALF_HEIGHT, dragStartHeight.value - dy));
        })
        .onEnd((event) => {
          const y = translateY.value;
          const height = sheetHeight.value;

          if (
            y > DISMISS_DRAG_PX ||
            (event.velocityY > DISMISS_VELOCITY && y > HALF_HEIGHT * 0.25)
          ) {
            runOnJS(animateClose)();
            return;
          }

          if (height > EXPAND_HEIGHT_THRESHOLD || event.velocityY < -DISMISS_VELOCITY) {
            sheetHeight.value = snapSheetTo(FULL_HEIGHT);
            translateY.value = snapSheetTo(0);
            return;
          }

          sheetHeight.value = snapSheetTo(HALF_HEIGHT);
          translateY.value = snapSheetTo(0);
        }),
    [animateClose, dragStartHeight, dragStartY, sheetHeight, translateY],
  );

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    height: sheetHeight.value,
    transform: [{ translateY: translateY.value }],
  }));

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const sheetBottomPadding = Math.max(insets.bottom, 16);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <RequestChatSheet
        visible={chatRequest !== null}
        requestId={chatRequest?.id ?? ""}
        serviceName={chatServiceName}
        inquiryDescription={chatRequest?.inquiryDescription ?? ""}
        onClose={handleCloseChat}
        onMessagesRead={handleChatRead}
      />
      <Animated.View
        pointerEvents="auto"
        className="rounded-t-3xl bg-white"
        style={[
          styles.sheet,
          sheetAnimatedStyle,
          { paddingBottom: sheetBottomPadding },
        ]}
      >
        <View className="px-5 pb-1 pt-2">
          <GestureDetector gesture={handlePanGesture}>
            <View
              accessibilityLabel="Potiahnite pre otvorenie alebo zatvorenie"
              accessibilityRole="adjustable"
              style={styles.handleTouchArea}
            >
              <View className="h-1.5 w-12 rounded-full bg-slate-300" />
            </View>
          </GestureDetector>
          <Text className="pb-2 text-xl font-bold text-casker-navy">Moje dopyty</Text>
        </View>

        <View className="flex-row items-end justify-between border-b border-slate-200 px-5">
          <View className="flex-row">
            <TabButton
              label="Aktívne"
              active={tab === "active"}
              badgeCount={activeTabPendingCount}
              onPress={() => setTab("active")}
            />
            <TabButton
              label="Hotové"
              active={tab === "received"}
              badgeCount={receivedTabPendingCount}
              onPress={() => setTab("received")}
            />
          </View>
          <TabButton
            label="História"
            active={tab === "history"}
            badgeCount={historyTabPendingCount}
            onPress={() => setTab("history")}
            align="right"
          />
        </View>

        {isLoading ? (
          <View style={styles.listArea} className="items-center justify-center">
            <ActivityIndicator size="large" color="#0b194f" />
          </View>
        ) : (
          <Animated.ScrollView
            style={styles.listArea}
            className="px-5 pt-4"
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            nestedScrollEnabled
            bounces
          >
            {visibleRequests.length === 0 ? (
              <View className="items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10">
                <Text className="text-center text-base text-slate-500">
                  {tab === "active"
                    ? "Momentálne nemáte žiadny aktívny dopyt."
                    : tab === "received"
                      ? "Momentálne tu nemáte žiadne hotové vozidlo na prevzatie."
                      : "Zatiaľ tu nemáte žiadnu históriu dopytov."}
                </Text>
              </View>
            ) : tab === "history" ? (
              groupedHistoryRequests.map((group) => (
                <View key={group.dateKey} className="mb-2">
                  <Text className="mb-3 text-base font-bold text-casker-navy">{group.label}</Text>
                  <View className="gap-3">
                    {group.requests.map((request) => (
                      <DriverRequestThread
                        key={request.id}
                        request={request}
                        mode="history"
                        hasUnseenHistoryNotification={hasUnseenHistoryNotification?.(request)}
                        onAcknowledgeHistoryNotification={onAcknowledgeHistoryNotification}
                        onUpdated={() => {
                          void onReload({ silent: true });
                        }}
                      />
                    ))}
                  </View>
                </View>
              ))
            ) : (
              visibleRequests.map((request) => (
                <DriverRequestThread
                  key={request.id}
                  request={request}
                  mode={tab}
                  canCancelRequest={
                    tab === "active" &&
                    isActiveDriverRequest(request.status) &&
                    cancellingId !== request.id
                  }
                  isConfirmingPickup={confirmingId === request.id}
                  onConfirmPickup={() => handleConfirmPickupPress(request)}
                  onCancelRequest={() => handleCancelPress(request)}
                  onUpdated={() => {
                    void onReload({ silent: true });
                  }}
                  busyResponseId={busyResponseId}
                  onBusyChange={setBusyResponseId}
                  onServiceFocus={onServiceFocus}
                  focusedServiceResponseId={focusedServiceResponseId}
                  onOpenChat={(serviceName) => handleOpenChat(request, serviceName)}
                />
              ))
            )}
          </Animated.ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

function TabButton({
  label,
  active,
  badgeCount = 0,
  onPress,
  align = "left",
}: {
  label: string;
  active: boolean;
  badgeCount?: number;
  onPress: () => void;
  align?: "left" | "right";
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`border-b-2 py-3 ${align === "right" ? "ml-4" : "mr-6"} ${
        active ? "border-casker-navy" : "border-transparent"
      }`}
    >
      <View className="flex-row items-center gap-1.5">
        <Text
          className={`text-base font-semibold ${active ? "text-casker-navy" : "text-slate-400"}`}
        >
          {label}
        </Text>
        <NotificationBadge count={badgeCount} size="sm" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    justifyContent: "flex-end",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
  },
  handleTouchArea: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  listArea: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    gap: 12,
    paddingBottom: 24,
  },
});
