import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { buttonShadow } from "@/constants/button-shadow";
import {
  addDays,
  buildDriverCalendarEntries,
  CALENDAR_HOUR_HEIGHT,
  formatCalendarHeaderDate,
  formatCalendarHourLabel,
  formatCalendarShortDay,
  getCalendarHourLabels,
  getCalendarTrackHeight,
  groupCalendarEntriesByTime,
  isSameDay,
  startOfWeek,
  toDateKey,
  type DriverCalendarEntry,
} from "@/lib/driver-calendar";
import type { DriverRequestSummary } from "@/lib/driver-requests-api";

type CalendarView = "day" | "week";

const WEEK_TIME_COLUMN_WIDTH = 44;
const WEEK_TIME_GUTTER = 12;
const WEEK_TIME_RAIL_WIDTH = WEEK_TIME_GUTTER + WEEK_TIME_COLUMN_WIDTH;
const WEEK_DAY_WIDTH = 88;
const WEEK_DAY_GAP = 6;
const WEEK_DAY_HEADER_HEIGHT = 34;
const WEEK_EDGE_SCROLL_TOLERANCE = 24;
const WEEK_EDGE_FLICK_MIN_DISTANCE = 108;
const WEEK_EDGE_FLICK_HORIZONTAL_RATIO = 1.35;
const DAY_SWIPE_COMMIT_RATIO = 0.12;
const DAY_SWIPE_COMMIT_MIN_PX = 36;
const DAY_SWIPE_COMMIT_VELOCITY = 280;
const DAY_SWIPE_DURATION_MS = 160;
const DAY_SWIPE_CANCEL_MS = 140;

const HOURS = getCalendarHourLabels();
const TRACK_HEIGHT = getCalendarTrackHeight();

type WeekScrollHandle = {
  scrollTo: (offset: { x?: number; y?: number }) => void;
};

type DriverCalendarSheetProps = {
  visible: boolean;
  onClose: () => void;
  requests: DriverRequestSummary[];
  isLoading?: boolean;
  onRefresh?: () => void;
};

export function DriverCalendarSheet({
  visible,
  onClose,
  requests,
  isLoading = false,
  onRefresh,
}: DriverCalendarSheetProps) {
  const [view, setView] = useState<CalendarView>("day");
  const [referenceDate, setReferenceDate] = useState(() => new Date());
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const viewRef = useRef<CalendarView>(view);
  const weekScrollRef = useRef<WeekScrollHandle>(null);
  const weekScrollMetricsRef = useRef({
    offsetX: 0,
    layoutWidth: 0,
    contentWidth: 0,
  });
  const weekNavFromEdgeRef = useRef(false);
  const weekEdgeNavLockRef = useRef(false);
  const [dayScrollResetToken, setDayScrollResetToken] = useState(0);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const today = useMemo(() => new Date(), [visible]);
  const entries = useMemo(() => buildDriverCalendarEntries(requests), [requests]);

  useEffect(() => {
    if (visible) {
      onRefresh?.();
    }
  }, [visible, onRefresh]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(referenceDate);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [referenceDate]);

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedEntryId) ?? null,
    [entries, selectedEntryId],
  );

  const navigatePeriod = useCallback((direction: -1 | 1) => {
    setReferenceDate((current) =>
      addDays(current, viewRef.current === "day" ? direction : direction * 7),
    );
    setSelectedEntryId(null);
  }, []);

  const restoreWeekScrollPosition = useCallback(() => {
    const targetX = weekNavFromEdgeRef.current
      ? weekScrollMetricsRef.current.offsetX
      : 0;

    weekScrollRef.current?.scrollTo({ x: targetX });
    weekNavFromEdgeRef.current = false;
  }, []);

  const navigateFromButton = useCallback(
    (direction: -1 | 1) => {
      if (viewRef.current === "week") {
        weekNavFromEdgeRef.current = false;
      }
      if (viewRef.current === "day") {
        setDayScrollResetToken((token) => token + 1);
      }
      navigatePeriod(direction);
    },
    [navigatePeriod],
  );

  const handleWeekHorizontalScroll = useCallback(
    (offsetX: number, layoutWidth: number, contentWidth: number) => {
      weekScrollMetricsRef.current = { offsetX, layoutWidth, contentWidth };
    },
    [],
  );

  const handleWeekEdgeFlick = useCallback(
    (
      offsetX: number,
      layoutWidth: number,
      contentWidth: number,
      translationX: number,
      translationY: number,
    ) => {
      if (viewRef.current !== "week" || weekEdgeNavLockRef.current) {
        return;
      }

      if (layoutWidth <= 0 || contentWidth <= 0) {
        return;
      }

      const absTranslationX = Math.abs(translationX);
      const absTranslationY = Math.abs(translationY);
      const isDeliberateHorizontalSwipe =
        absTranslationX >= WEEK_EDGE_FLICK_MIN_DISTANCE &&
        absTranslationX >= absTranslationY * WEEK_EDGE_FLICK_HORIZONTAL_RATIO;

      if (!isDeliberateHorizontalSwipe) {
        return;
      }

      const maxX = Math.max(0, contentWidth - layoutWidth);
      const atLeftEdge = offsetX <= WEEK_EDGE_SCROLL_TOLERANCE;
      const atRightEdge =
        maxX <= WEEK_EDGE_SCROLL_TOLERANCE ||
        offsetX >= maxX - WEEK_EDGE_SCROLL_TOLERANCE;
      const fullWeekVisible = maxX <= WEEK_EDGE_SCROLL_TOLERANCE;

      let direction: -1 | 1 | null = null;

      if (fullWeekVisible) {
        if (translationX >= WEEK_EDGE_FLICK_MIN_DISTANCE) {
          direction = -1;
        } else if (translationX <= -WEEK_EDGE_FLICK_MIN_DISTANCE) {
          direction = 1;
        }
      } else if (atLeftEdge && translationX >= WEEK_EDGE_FLICK_MIN_DISTANCE) {
        direction = -1;
      } else if (atRightEdge && translationX <= -WEEK_EDGE_FLICK_MIN_DISTANCE) {
        direction = 1;
      }

      if (direction === null) {
        return;
      }

      weekEdgeNavLockRef.current = true;
      weekNavFromEdgeRef.current = true;
      weekScrollMetricsRef.current = {
        offsetX,
        layoutWidth,
        contentWidth,
      };
      weekScrollRef.current?.scrollTo({ x: offsetX });
      navigatePeriod(direction);
      requestAnimationFrame(() => {
        weekEdgeNavLockRef.current = false;
      });
    },
    [navigatePeriod],
  );

  useLayoutEffect(() => {
    if (view !== "week") {
      return;
    }

    restoreWeekScrollPosition();
  }, [referenceDate, restoreWeekScrollPosition, view]);

  useEffect(() => {
    weekNavFromEdgeRef.current = false;
    if (view === "week") {
      weekScrollRef.current?.scrollTo({ x: 0, y: 0 });
    }
  }, [view]);

  const jumpToToday = () => {
    weekNavFromEdgeRef.current = false;
    setDayScrollResetToken((token) => token + 1);
    setReferenceDate(new Date());
    setSelectedEntryId(null);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.modalRoot}>
      <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
        <View className="flex-row items-center border-b border-slate-200 px-4 py-3">
          <Pressable
            onPress={onClose}
            className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 active:opacity-80"
            style={buttonShadow}
          >
            <FontAwesome name="chevron-left" size={16} color="#0b194f" />
          </Pressable>
          <Text className="ml-3 text-xl font-bold text-casker-navy">Kalendár</Text>
        </View>

        <View className="border-b border-slate-200 px-4 py-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => navigateFromButton(-1)}
                className="h-9 w-9 items-center justify-center rounded-full bg-slate-100 active:opacity-80"
              >
                <FontAwesome name="chevron-left" size={14} color="#0b194f" />
              </Pressable>
              <Pressable
                onPress={jumpToToday}
                className="rounded-full border border-slate-200 px-3 py-1.5 active:bg-slate-50"
              >
                <Text className="text-xs font-semibold text-casker-navy">Dnes</Text>
              </Pressable>
              <Pressable
                onPress={() => navigateFromButton(1)}
                className="h-9 w-9 items-center justify-center rounded-full bg-slate-100 active:opacity-80"
              >
                <FontAwesome name="chevron-right" size={14} color="#0b194f" />
              </Pressable>
            </View>

            <View className="flex-row rounded-full border border-slate-200 bg-slate-50 p-0.5">
              <ViewModeButton
                label="Deň"
                active={view === "day"}
                onPress={() => setView("day")}
              />
              <ViewModeButton
                label="Týždeň"
                active={view === "week"}
                onPress={() => setView("week")}
              />
            </View>
          </View>

          <View style={styles.swipeHeaderZone}>
            <Text className="text-center text-sm font-semibold text-slate-600">
              {view === "day"
                ? formatCalendarHeaderDate(referenceDate)
                : `${formatCalendarShortDay(weekDays[0])} – ${formatCalendarShortDay(weekDays[6])}`}
            </Text>
            {view === "day" ? (
              <Text className="mt-1 text-center text-[11px] text-slate-400">
                Potiahni vľavo/vpravo pre ďalší deň
              </Text>
            ) : null}
          </View>
        </View>

        <View className="flex-1" key={view}>
          {isLoading ? (
            <View className="flex-1 items-center justify-center px-8">
              <Text className="text-sm text-slate-500">Načítavam termíny…</Text>
            </View>
          ) : entries.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8">
              <Text className="text-center text-base text-slate-600">
                Zatiaľ nemáte prijaté termíny. Po prijatí ponuky od servisu sa tu zobrazia.
              </Text>
            </View>
          ) : view === "day" ? (
            <DaySwipeCalendar
              referenceDate={referenceDate}
              entries={entries}
              selectedEntryId={selectedEntryId}
              onSelectEntry={setSelectedEntryId}
              onNavigate={navigatePeriod}
              resetToken={dayScrollResetToken}
            />
          ) : (
            <WeekCalendarPanel
              ref={weekScrollRef}
              weekDays={weekDays}
              entries={entries}
              today={today}
              selectedEntryId={selectedEntryId}
              onSelectEntry={setSelectedEntryId}
              onHorizontalScroll={handleWeekHorizontalScroll}
              onHorizontalScrollEnd={handleWeekEdgeFlick}
            />
          )}
        </View>

        {selectedEntry ? (
          <View className="border-t border-slate-200 bg-slate-50 px-4 py-3">
            <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Vybraný termín
            </Text>
            <Text className="mt-1 text-base font-bold text-casker-navy">
              {selectedEntry.vehicleLabel}
            </Text>
            <Text className="mt-0.5 text-sm text-slate-600">
              {selectedEntry.serviceName} · EČ {selectedEntry.licensePlate}
            </Text>
            <Text className="mt-1 text-sm font-semibold text-casker-navy">
              {formatCalendarShortDay(new Date(`${selectedEntry.appointmentDate}T12:00:00`))} ·{" "}
              {selectedEntry.appointmentTime.slice(0, 5)}
            </Text>
          </View>
        ) : null}
      </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

function DaySwipeCalendar({
  referenceDate,
  entries,
  selectedEntryId,
  onSelectEntry,
  onNavigate,
  resetToken,
}: {
  referenceDate: Date;
  entries: DriverCalendarEntry[];
  selectedEntryId: string | null;
  onSelectEntry: (id: string | null) => void;
  onNavigate: (direction: -1 | 1) => void;
  resetToken: number;
}) {
  const panelWidthShared = useSharedValue(0);
  const translateX = useSharedValue(0);
  const isNavigating = useSharedValue(false);
  const pendingSlideResetRef = useRef(false);

  const dayEntries = useMemo(
    () => entries.filter((entry) => entry.appointmentDate === toDateKey(referenceDate)),
    [entries, referenceDate],
  );
  const dayEntryGroups = useMemo(
    () => groupCalendarEntriesByTime(dayEntries),
    [dayEntries],
  );

  const finishNavigate = useCallback(
    (direction: -1 | 1) => {
      pendingSlideResetRef.current = true;
      onNavigate(direction);
    },
    [onNavigate],
  );

  useLayoutEffect(() => {
    if (!pendingSlideResetRef.current) {
      return;
    }

    pendingSlideResetRef.current = false;
    translateX.value = 0;
    isNavigating.value = false;
  }, [referenceDate, isNavigating, translateX]);

  useEffect(() => {
    translateX.value = 0;
    isNavigating.value = false;
  }, [resetToken, isNavigating, translateX]);

  const scrollGesture = useMemo(() => Gesture.Native(), []);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-8, 8])
        .failOffsetY([-14, 14])
        .onUpdate((event) => {
          if (isNavigating.value) {
            return;
          }

          translateX.value = event.translationX;
        })
        .onEnd((event) => {
          const width = panelWidthShared.value;
          if (width <= 0 || isNavigating.value) {
            return;
          }

          const dragThreshold = Math.max(DAY_SWIPE_COMMIT_MIN_PX, width * DAY_SWIPE_COMMIT_RATIO);
          const goNext =
            event.translationX < -dragThreshold ||
            event.velocityX < -DAY_SWIPE_COMMIT_VELOCITY;
          const goPrev =
            event.translationX > dragThreshold ||
            event.velocityX > DAY_SWIPE_COMMIT_VELOCITY;
          const slideOut = { duration: DAY_SWIPE_DURATION_MS, easing: Easing.out(Easing.cubic) };
          const slideBack = { duration: DAY_SWIPE_CANCEL_MS, easing: Easing.out(Easing.quad) };

          if (goNext) {
            isNavigating.value = true;
            translateX.value = withTiming(-width, slideOut, (finished) => {
              if (finished) {
                runOnJS(finishNavigate)(1);
              }
            });
            return;
          }

          if (goPrev) {
            isNavigating.value = true;
            translateX.value = withTiming(width, slideOut, (finished) => {
              if (finished) {
                runOnJS(finishNavigate)(-1);
              }
            });
            return;
          }

          translateX.value = withTiming(0, slideBack);
        }),
    [finishNavigate, isNavigating, panelWidthShared, translateX],
  );

  const panelStyle = useAnimatedStyle(() => ({
    flex: 1,
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      style={styles.daySwipeViewport}
      onLayout={(event) => {
        panelWidthShared.value = event.nativeEvent.layout.width;
      }}
    >
      <GestureDetector gesture={panGesture}>
        <Animated.View style={panelStyle}>
          <GestureDetector gesture={scrollGesture}>
            <DayCalendarPanel
              dayEntries={dayEntries}
              dayEntryGroups={dayEntryGroups}
              selectedEntryId={selectedEntryId}
              onSelectEntry={onSelectEntry}
            />
          </GestureDetector>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function DayCalendarPanel({
  dayEntries,
  dayEntryGroups,
  selectedEntryId,
  onSelectEntry,
}: {
  dayEntries: DriverCalendarEntry[];
  dayEntryGroups: ReturnType<typeof groupCalendarEntriesByTime>;
  selectedEntryId: string | null;
  onSelectEntry: (id: string | null) => void;
}) {
  return (
    <ScrollView
      style={styles.calendarScroll}
      contentContainerStyle={[styles.scrollContent, { minHeight: TRACK_HEIGHT + 56 }]}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      {dayEntries.length === 0 ? (
        <Text className="mb-3 px-4 text-center text-sm text-slate-500">
          V tomto dni nemáte žiadny prijatý termín.
        </Text>
      ) : null}
      <DayTimeGrid
        groups={dayEntryGroups}
        selectedEntryId={selectedEntryId}
        onSelectEntry={onSelectEntry}
      />
    </ScrollView>
  );
}

function ViewModeButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full px-3 py-1.5 ${active ? "bg-white" : ""}`}
      style={active ? buttonShadow : undefined}
    >
      <Text
        className={`text-xs font-semibold ${active ? "text-casker-navy" : "text-slate-500"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function clampScrollOffset(value: number, maxOffset: number) {
  "worklet";
  return Math.min(Math.max(value, 0), Math.max(0, maxOffset));
}

const WeekCalendarPanel = forwardRef<
  WeekScrollHandle,
  {
    weekDays: Date[];
    entries: DriverCalendarEntry[];
    today: Date;
    selectedEntryId: string | null;
    onSelectEntry: (id: string | null) => void;
    onHorizontalScroll?: (offsetX: number, layoutWidth: number, contentWidth: number) => void;
    onHorizontalScrollEnd?: (
      offsetX: number,
      layoutWidth: number,
      contentWidth: number,
      translationX: number,
      translationY: number,
    ) => void;
  }
>(function WeekCalendarPanel(
  {
    weekDays,
    entries,
    today,
    selectedEntryId,
    onSelectEntry,
    onHorizontalScroll,
    onHorizontalScrollEnd,
  },
  ref,
) {
  const scrollX = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const viewportWidth = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  const contentWidth = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const nativePressGesture = useMemo(() => Gesture.Native(), []);

  const reportScroll = useCallback(
    (offsetX: number, layoutWidth: number, contentWidthValue: number) => {
      onHorizontalScroll?.(offsetX, layoutWidth, contentWidthValue);
    },
    [onHorizontalScroll],
  );

  const reportScrollEnd = useCallback(
    (
      offsetX: number,
      layoutWidth: number,
      contentWidthValue: number,
      translationX: number,
      translationY: number,
    ) => {
      onHorizontalScrollEnd?.(
        offsetX,
        layoutWidth,
        contentWidthValue,
        translationX,
        translationY,
      );
    },
    [onHorizontalScrollEnd],
  );

  useImperativeHandle(
    ref,
    () => ({
      scrollTo: ({ x, y }) => {
        const maxX = Math.max(0, contentWidth.value - viewportWidth.value);
        const maxY = Math.max(0, contentHeight.value - viewportHeight.value);
        if (x !== undefined) {
          scrollX.value = clampScrollOffset(x, maxX);
        }
        if (y !== undefined) {
          scrollY.value = clampScrollOffset(y, maxY);
        }
      },
    }),
    [contentHeight, contentWidth, scrollX, scrollY, viewportHeight, viewportWidth],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(4)
        .simultaneousWithExternalGesture(nativePressGesture)
        .onBegin(() => {
          panStartX.value = scrollX.value;
          panStartY.value = scrollY.value;
        })
        .onUpdate((event) => {
          const maxX = Math.max(0, contentWidth.value - viewportWidth.value);
          const maxY = Math.max(0, contentHeight.value - viewportHeight.value);
          const nextX = clampScrollOffset(panStartX.value - event.translationX, maxX);
          const nextY = clampScrollOffset(panStartY.value - event.translationY, maxY);
          scrollX.value = nextX;
          scrollY.value = nextY;

          if (onHorizontalScroll) {
            runOnJS(reportScroll)(nextX, viewportWidth.value, contentWidth.value);
          }
        })
        .onEnd((event) => {
          const maxX = Math.max(0, contentWidth.value - viewportWidth.value);
          const maxY = Math.max(0, contentHeight.value - viewportHeight.value);
          const endX = scrollX.value;
          const endY = scrollY.value;

          scrollX.value = withDecay({
            velocity: -event.velocityX,
            clamp: [0, maxX],
            rubberBandEffect: true,
          });
          scrollY.value = withDecay({
            velocity: -event.velocityY,
            clamp: [0, maxY],
            rubberBandEffect: true,
          });

          if (onHorizontalScrollEnd) {
            runOnJS(reportScrollEnd)(
              endX,
              viewportWidth.value,
              contentWidth.value,
              event.translationX,
              event.translationY,
            );
          }
        }),
    [
      contentHeight,
      contentWidth,
      nativePressGesture,
      onHorizontalScroll,
      onHorizontalScrollEnd,
      panStartX,
      panStartY,
      reportScroll,
      reportScrollEnd,
      scrollX,
      scrollY,
      viewportHeight,
      viewportWidth,
    ],
  );

  const headerScrollStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -scrollX.value }],
  }));

  const timeScrollStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -scrollY.value }],
  }));

  const gridScrollStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -scrollX.value },
      { translateY: -scrollY.value },
    ],
  }));

  return (
    <View style={styles.week2DViewport}>
      <View style={styles.weekFrozenHeaderRow}>
        <View style={styles.weekCornerCell} />
        <View style={styles.weekDayHeadersClip}>
          <Animated.View style={headerScrollStyle}>
            <View style={styles.weekDayHeadersRow}>
              {weekDays.map((day, dayIndex) => {
                const isToday = isSameDay(day, today);

                return (
                  <View
                    key={`week-head-${dayIndex}`}
                    style={[
                      styles.weekDayHeaderCell,
                      dayIndex > 0 && styles.weekDayHeaderCellGap,
                      isToday && styles.weekDayColumnToday,
                    ]}
                  >
                    <Text style={styles.weekDayHead}>{formatCalendarShortDay(day)}</Text>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        </View>
      </View>

      <View style={styles.weekFrozenBody}>
        <View style={styles.weekTimeRail}>
          <View style={styles.weekTimeRailClip}>
            <Animated.View style={timeScrollStyle}>
              <View style={{ height: TRACK_HEIGHT }}>
                {HOURS.map((hour) => (
                  <Text key={hour} style={styles.hourLabel}>
                    {formatCalendarHourLabel(hour)}
                  </Text>
                ))}
              </View>
            </Animated.View>
          </View>
        </View>

        <View
          style={styles.weekScrollableViewport}
          onLayout={(event) => {
            viewportWidth.value = event.nativeEvent.layout.width;
            viewportHeight.value = event.nativeEvent.layout.height;
          }}
        >
          <GestureDetector gesture={panGesture}>
            <Animated.View style={styles.week2DCanvas}>
              <Animated.View
                style={[styles.week2DContent, gridScrollStyle]}
                onLayout={(event) => {
                  contentWidth.value = event.nativeEvent.layout.width;
                  contentHeight.value = event.nativeEvent.layout.height;
                }}
              >
                <View style={styles.weekDayBodyRow}>
                  {weekDays.map((day, dayIndex) => {
                    const dayKey = toDateKey(day);
                    const items = entries.filter((entry) => entry.appointmentDate === dayKey);
                    const groups = groupCalendarEntriesByTime(items);
                    const isToday = isSameDay(day, today);

                    return (
                      <View
                        key={`week-day-${dayIndex}`}
                        style={[
                          styles.weekDayBodyColumn,
                          dayIndex > 0 && styles.weekDayBodyColumnGap,
                          isToday && styles.weekDayColumnToday,
                        ]}
                      >
                        <View style={[styles.timeTrack, { height: TRACK_HEIGHT }]}>
                          {renderHourLines()}
                          {groups.map((group) => (
                            <View
                              key={group.timeKey}
                              style={[styles.eventStack, { top: group.top }]}
                            >
                              {group.items.map((entry) => (
                                <GestureDetector key={entry.id} gesture={nativePressGesture}>
                                  <CalendarEventCard
                                    entry={entry}
                                    compact
                                    selected={selectedEntryId === entry.id}
                                    onPress={() =>
                                      onSelectEntry(selectedEntryId === entry.id ? null : entry.id)
                                    }
                                  />
                                </GestureDetector>
                              ))}
                            </View>
                          ))}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </Animated.View>
            </Animated.View>
          </GestureDetector>
        </View>
      </View>
    </View>
  );
});

function DayTimeGrid({
  groups,
  selectedEntryId,
  onSelectEntry,
}: {
  groups: ReturnType<typeof groupCalendarEntriesByTime>;
  selectedEntryId: string | null;
  onSelectEntry: (id: string | null) => void;
}) {
  return (
    <View style={styles.dayGrid}>
      <View style={styles.dayTimeLabels}>
        {HOURS.map((hour) => (
          <Text key={hour} style={styles.hourLabel}>
            {formatCalendarHourLabel(hour)}
          </Text>
        ))}
      </View>

      <View style={[styles.timeTrack, { height: TRACK_HEIGHT }]}>
        {renderHourLines()}
        {groups.map((group) => (
          <View key={group.timeKey} style={[styles.eventStack, { top: group.top }]}>
            {group.items.map((entry) => (
              <CalendarEventCard
                key={entry.id}
                entry={entry}
                selected={selectedEntryId === entry.id}
                onPress={() =>
                  onSelectEntry(selectedEntryId === entry.id ? null : entry.id)
                }
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function CalendarEventCard({
  entry,
  compact = false,
  selected = false,
  onPress,
}: {
  entry: DriverCalendarEntry;
  compact?: boolean;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.eventCard,
        compact && styles.eventCardCompact,
        selected && styles.eventCardSelected,
      ]}
    >
      <Text style={[styles.eventTime, compact && styles.eventTimeCompact]}>
        {entry.appointmentTime.slice(0, 5)}
      </Text>
      <Text
        style={[styles.eventTitle, compact && styles.eventTitleCompact]}
        numberOfLines={compact ? 2 : 3}
      >
        {entry.vehicleLabel}
      </Text>
      {!compact ? (
        <Text style={styles.eventSubtitle} numberOfLines={1}>
          {entry.serviceName}
        </Text>
      ) : null}
    </Pressable>
  );
}

function renderHourLines() {
  return HOURS.map((hour) => <View key={hour} style={styles.hourLine} />);
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  daySwipeViewport: {
    flex: 1,
    overflow: "hidden",
  },
  swipeHeaderZone: {
    marginTop: 12,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  calendarScroll: {
    flex: 1,
  },
  week2DViewport: {
    flex: 1,
    overflow: "hidden",
    paddingTop: 8,
  },
  weekFrozenHeaderRow: {
    flexDirection: "row",
    zIndex: 2,
  },
  weekCornerCell: {
    width: WEEK_TIME_RAIL_WIDTH,
    height: WEEK_DAY_HEADER_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15, 23, 42, 0.08)",
    backgroundColor: "#ffffff",
  },
  weekDayHeadersClip: {
    flex: 1,
    height: WEEK_DAY_HEADER_HEIGHT,
    overflow: "hidden",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15, 23, 42, 0.08)",
    backgroundColor: "#ffffff",
  },
  weekDayHeadersRow: {
    flexDirection: "row",
    paddingRight: 12,
  },
  weekDayHeaderCell: {
    width: WEEK_DAY_WIDTH,
    height: WEEK_DAY_HEADER_HEIGHT,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.1)",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.98)",
  },
  weekDayHeaderCellGap: {
    marginLeft: WEEK_DAY_GAP,
  },
  weekFrozenBody: {
    flex: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  weekTimeRail: {
    width: WEEK_TIME_RAIL_WIDTH,
    zIndex: 2,
    backgroundColor: "#ffffff",
  },
  weekTimeRailClip: {
    flex: 1,
    overflow: "hidden",
    paddingLeft: WEEK_TIME_GUTTER,
    width: WEEK_TIME_COLUMN_WIDTH + WEEK_TIME_GUTTER,
  },
  weekScrollableViewport: {
    flex: 1,
    overflow: "hidden",
  },
  week2DCanvas: {
    ...StyleSheet.absoluteFillObject,
  },
  week2DContent: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  weekDayBodyRow: {
    flexDirection: "row",
    paddingRight: 12,
    paddingBottom: 16,
  },
  weekDayBodyColumn: {
    width: WEEK_DAY_WIDTH,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "rgba(15, 23, 42, 0.1)",
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
  },
  weekDayBodyColumnGap: {
    marginLeft: WEEK_DAY_GAP,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  dayGrid: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 10,
  },
  dayTimeLabels: {
    width: 44,
  },
  hourLabel: {
    height: CALENDAR_HOUR_HEIGHT,
    paddingTop: 2,
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    textAlign: "right",
  },
  timeTrack: {
    position: "relative",
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 3,
  },
  hourLine: {
    height: CALENDAR_HOUR_HEIGHT,
    borderTopWidth: 1,
    borderTopColor: "rgba(15, 23, 42, 0.1)",
  },
  eventStack: {
    position: "absolute",
    left: 3,
    right: 3,
    gap: 4,
  },
  eventCard: {
    borderWidth: 2,
    borderColor: "rgba(11, 25, 79, 0.16)",
    borderRadius: 8,
    backgroundColor: "rgba(11, 25, 79, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  eventCardCompact: {
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  eventCardSelected: {
    borderColor: "#0b194f",
    backgroundColor: "rgba(11, 25, 79, 0.16)",
  },
  eventTime: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0b194f",
  },
  eventTimeCompact: {
    fontSize: 9,
  },
  eventTitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  eventTitleCompact: {
    fontSize: 10,
    lineHeight: 13,
  },
  eventSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: "#475569",
  },
  weekDayColumnToday: {
    borderColor: "rgba(11, 25, 79, 0.28)",
    backgroundColor: "rgba(11, 25, 79, 0.04)",
  },
  weekDayHead: {
    paddingHorizontal: 4,
    fontSize: 10,
    fontWeight: "700",
    color: "#334155",
    textAlign: "center",
  },
});
