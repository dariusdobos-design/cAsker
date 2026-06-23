import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ServiceMapCalloutCard } from "@/components/service-map-callout-card";
import type { MapServiceMarker } from "@/lib/map-services-api";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHEET_OPEN_Y = SCREEN_HEIGHT * 0.38;
const SHEET_HIDDEN_Y = SCREEN_HEIGHT;
const ANIM_MS = 300;

type ServiceMapSheetProps = {
  visible: boolean;
  service: MapServiceMarker | null;
  onRequestClose: () => void;
  onClosed: () => void;
};

export function ServiceMapSheet({
  visible,
  service,
  onRequestClose,
  onClosed,
}: ServiceMapSheetProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(SHEET_HIDDEN_Y);

  useEffect(() => {
    translateY.value = withTiming(
      visible ? SHEET_OPEN_Y : SHEET_HIDDEN_Y,
      {
        duration: ANIM_MS,
        easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      },
      (finished) => {
        if (finished && !visible) {
          runOnJS(onClosed)();
        }
      },
    );
  }, [onClosed, translateY, visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const dragGesture = Gesture.Pan()
    .onUpdate((event) => {
      const next = Math.max(SHEET_OPEN_Y, SHEET_OPEN_Y + event.translationY);
      translateY.value = next;
    })
    .onEnd((event) => {
      if (event.translationY > 80 || event.velocityY > 700) {
        runOnJS(onRequestClose)();
      } else {
        translateY.value = withTiming(SHEET_OPEN_Y, {
          duration: ANIM_MS,
          easing: Easing.out(Easing.cubic),
        });
      }
    });

  if (!service) {
    return null;
  }

  return (
    <>
      {visible ? (
        <Pressable
          style={styles.backdrop}
          onPress={onRequestClose}
          accessibilityLabel="Zavrieť kartu servisu"
        />
      ) : null}

      <GestureDetector gesture={dragGesture}>
        <Animated.View
          style={[
            styles.sheet,
            sheetStyle,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <View style={styles.handle} />
          <ServiceMapCalloutCard service={service} onClose={onRequestClose} />
        </Animated.View>
      </GestureDetector>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    backgroundColor: "rgba(15, 23, 42, 0.22)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 31,
    elevation: 31,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: "#ffffff",
    paddingTop: 8,
    paddingHorizontal: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#cbd5e1",
    marginBottom: 10,
  },
});
