import { useEffect, useState, type ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { NotificationBadge } from "@/components/notification-badge";
import { buttonShadow } from "@/constants/button-shadow";

const MENU_BUTTON_SIZE = 68;
const MENU_ITEM_HEIGHT = 48;
const ITEM_GAP = 8;
const PANEL_HEIGHT = MENU_ITEM_HEIGHT * 4 + ITEM_GAP * 3;
const PANEL_OPEN_MS = 240;

type DriverTopMenuProps = {
  pendingCount?: number;
  onGarage: () => void;
  onCalendar: () => void;
  onMyRequests: () => void;
  onAccount: () => void;
};

type MenuAction = {
  id: string;
  label: string;
  icon: ComponentProps<typeof FontAwesome>["name"];
  onPress: () => void;
};

export function DriverTopMenu({
  pendingCount = 0,
  onGarage,
  onCalendar,
  onMyRequests,
  onAccount,
}: DriverTopMenuProps) {
  const [open, setOpen] = useState(false);
  const progress = useSharedValue(0);

  const toggleMenu = () => setOpen((value) => !value);

  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, {
      duration: PANEL_OPEN_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [open, progress]);

  const panelRevealStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [0, PANEL_HEIGHT]),
    opacity: interpolate(progress.value, [0, 0.4, 1], [0, 1, 1]),
  }));

  const closeAndRun = (action: () => void) => {
    setOpen(false);
    action();
  };

  const actions: MenuAction[] = [
    {
      id: "garage",
      label: "Garáž",
      icon: "car",
      onPress: () => closeAndRun(onGarage),
    },
    {
      id: "calendar",
      label: "Kalendár",
      icon: "calendar",
      onPress: () => closeAndRun(onCalendar),
    },
    {
      id: "requests",
      label: "Moje dopyty",
      icon: "clipboard",
      onPress: () => closeAndRun(onMyRequests),
    },
    {
      id: "account",
      label: "Účet",
      icon: "user",
      onPress: () => closeAndRun(onAccount),
    },
  ];

  return (
    <View style={styles.menuUnit}>
      <Pressable
        accessibilityLabel="Menu"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={toggleMenu}
        className="items-center justify-center rounded-full border border-slate-200 bg-white active:bg-slate-50"
        style={[buttonShadow, styles.menuButton]}
      >
        <FontAwesome name="bars" size={28} color="#0b194f" />
        <View style={styles.menuButtonBadge} pointerEvents="none">
          <NotificationBadge count={pendingCount} />
        </View>
      </Pressable>

      <View style={styles.panelOuter}>
        <Animated.View
          style={[styles.panelReveal, panelRevealStyle]}
          pointerEvents={open ? "auto" : "none"}
        >
          <View style={styles.menuItems}>
            {actions.map((action) => (
              <Pressable
                key={action.id}
                onPress={action.onPress}
                className="flex-row items-center gap-3 rounded-full border border-slate-200 bg-white px-4 active:bg-slate-50"
                style={styles.menuItem}
              >
                <FontAwesome name={action.icon} size={17} color="#0b194f" />
                <Text className="text-sm font-semibold text-casker-navy">{action.label}</Text>
                {action.id === "requests" ? (
                  <View style={styles.menuItemBadge} pointerEvents="none">
                    <NotificationBadge count={pendingCount} size="sm" />
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  menuUnit: {
    alignItems: "flex-end",
  },
  menuButton: {
    width: MENU_BUTTON_SIZE,
    height: MENU_BUTTON_SIZE,
    overflow: "visible",
  },
  menuButtonBadge: {
    position: "absolute",
    top: -2,
    right: -2,
  },
  menuItemBadge: {
    marginLeft: 2,
  },
  panelOuter: {
    marginTop: 10,
    overflow: "visible",
  },
  panelReveal: {
    overflow: "hidden",
  },
  menuItems: {
    gap: ITEM_GAP,
    alignItems: "flex-end",
  },
  menuItem: {
    height: MENU_ITEM_HEIGHT,
    minWidth: MENU_BUTTON_SIZE,
  },
});
