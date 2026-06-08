import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  isActiveDriverRequest,
  type DriverRequestSummary,
  type DriverServiceResponse,
} from "@/lib/driver-requests-api";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHEET_HEIGHT = SCREEN_HEIGHT;
const SNAP_FULL = SCREEN_HEIGHT * 0.08;
const SNAP_HALF = SCREEN_HEIGHT * 0.5;
const SNAP_HIDDEN = SCREEN_HEIGHT;
const EXPAND_SNAP_THRESHOLD = SNAP_FULL + (SNAP_HALF - SNAP_FULL) * 0.35;
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

type MyRequestsTab = "active" | "history";

type MyRequestsSheetProps = {
  visible: boolean;
  onClose: () => void;
  requests: DriverRequestSummary[];
  isLoading: boolean;
  onReload: (options?: { silent?: boolean }) => Promise<void>;
  activeTabPendingCount?: number;
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
  onServiceFocus,
  focusedServiceResponseId = null,
}: MyRequestsSheetProps) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<MyRequestsTab>("active");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [busyResponseId, setBusyResponseId] = useState<string | null>(null);
  const [chatRequest, setChatRequest] = useState<DriverRequestSummary | null>(null);
  const [chatServiceName, setChatServiceName] = useState("Servis");

  const translateY = useSharedValue(SNAP_HIDDEN);
  const scrollY = useSharedValue(0);
  const isClosing = useSharedValue(false);
  const dragStartY = useSharedValue(SNAP_HALF);

  const activeRequests = useMemo(
    () => requests.filter((request) => isActiveDriverRequest(request.status)),
    [requests],
  );

  const historyRequests = useMemo(
    () => requests.filter((request) => !isActiveDriverRequest(request.status)),
    [requests],
  );

  const visibleRequests = tab === "active" ? activeRequests : historyRequests;

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
      SNAP_HIDDEN,
      { duration: SHEET_CLOSE_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(finishClose)();
        } else {
          isClosing.value = false;
        }
      },
    );
  }, [finishClose, isClosing, translateY]);

  useLayoutEffect(() => {
    if (!visible) {
      return;
    }
    isClosing.value = false;
    scrollY.value = 0;
    translateY.value = SNAP_HIDDEN;
    translateY.value = withTiming(SNAP_HALF, {
      duration: SHEET_OPEN_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [visible, isClosing, scrollY, translateY]);

  const handleChatRead = useCallback(() => {
    void onReload({ silent: true });
  }, [onReload]);

  const handleOpenChat = useCallback((request: DriverRequestSummary, serviceName: string) => {
    setChatRequest(request);
    setChatServiceName(serviceName);
  }, []);

  const handleCloseChat = useCallback(() => {
    setChatRequest(null);
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

  const scrollGesture = useMemo(() => Gesture.Native(), []);

  const handlePanGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-6, 6])
        .failOffsetX([-20, 20])
        .onBegin(() => {
          dragStartY.value = translateY.value;
        })
        .onUpdate((event) => {
          const nextY = dragStartY.value + event.translationY;
          translateY.value = Math.min(Math.max(nextY, SNAP_FULL), SNAP_HIDDEN);
        })
        .onEnd((event) => {
          const y = translateY.value;

          if (
            y > SNAP_HALF + DISMISS_DRAG_PX ||
            (event.velocityY > DISMISS_VELOCITY && y > SNAP_HALF * 0.7)
          ) {
            if (!isClosing.value) {
              isClosing.value = true;
              translateY.value = withTiming(
                SNAP_HIDDEN,
                { duration: SHEET_CLOSE_MS, easing: Easing.in(Easing.cubic) },
                (finished) => {
                  if (finished) {
                    runOnJS(finishClose)();
                  } else {
                    isClosing.value = false;
                  }
                },
              );
            }
            return;
          }

          if (y < EXPAND_SNAP_THRESHOLD || event.velocityY < -DISMISS_VELOCITY) {
            translateY.value = snapSheetTo(SNAP_FULL);
            return;
          }

          translateY.value = snapSheetTo(SNAP_HALF);
        }),
    [dragStartY, finishClose, isClosing, translateY],
  );

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
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
          { height: SHEET_HEIGHT, paddingBottom: sheetBottomPadding },
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

            <View className="flex-row border-b border-slate-200 px-5">
              <TabButton
                label="Aktívne"
                active={tab === "active"}
                badgeCount={activeTabPendingCount}
                onPress={() => setTab("active")}
              />
              <TabButton
                label="História"
                active={tab === "history"}
                onPress={() => setTab("history")}
              />
            </View>

              {isLoading ? (
                <View className="flex-1 items-center justify-center py-16">
                  <ActivityIndicator size="large" color="#0b194f" />
                </View>
              ) : (
                <GestureDetector gesture={scrollGesture}>
                  <Animated.ScrollView
                    className="flex-1 px-5 pt-4"
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    onScroll={scrollHandler}
                    scrollEventThrottle={16}
                    bounces
                  >
                    {visibleRequests.length === 0 ? (
                      <View className="items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10">
                        <Text className="text-center text-base text-slate-500">
                          {tab === "active"
                            ? "Momentálne nemáte žiadny aktívny dopyt."
                            : "Zatiaľ tu nemáte žiadnu históriu dopytov."}
                        </Text>
                      </View>
                    ) : (
                      visibleRequests.map((request) => (
                        <DriverRequestThread
                          key={request.id}
                          request={request}
                          canCancelRequest={
                            tab === "active" &&
                            isActiveDriverRequest(request.status) &&
                            cancellingId !== request.id
                          }
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
                </GestureDetector>
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
}: {
  label: string;
  active: boolean;
  badgeCount?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`mr-6 border-b-2 py-3 ${active ? "border-casker-navy" : "border-transparent"}`}
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
  },
  handleTouchArea: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  listContent: {
    gap: 12,
    paddingBottom: 32,
  },
});
