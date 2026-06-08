import { StyleSheet, Text, View } from "react-native";

type NotificationBadgeProps = {
  count: number;
  size?: "sm" | "md";
};

export function NotificationBadge({ count, size = "md" }: NotificationBadgeProps) {
  if (count <= 0) {
    return null;
  }

  const label = count > 9 ? "9+" : String(count);
  const isSmall = size === "sm";

  return (
    <View
      style={[
        styles.badge,
        isSmall ? styles.badgeSm : styles.badgeMd,
      ]}
      accessibilityLabel={`${count} nových upozornení`}
    >
      <Text style={[styles.text, isSmall ? styles.textSm : styles.textMd]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#dc2626",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  badgeMd: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
  },
  badgeSm: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
  },
  text: {
    color: "#ffffff",
    fontWeight: "800",
  },
  textMd: {
    fontSize: 12,
    lineHeight: 14,
  },
  textSm: {
    fontSize: 10,
    lineHeight: 12,
  },
});
