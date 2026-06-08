import { StyleSheet, Text, View } from "react-native";

export function NotificationAlertIcon() {
  return (
    <View style={styles.icon} accessibilityLabel="Nová ponuka termínu">
      <Text style={styles.glyph}>?</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dc2626",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  glyph: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 15,
    marginTop: -1,
  },
});
