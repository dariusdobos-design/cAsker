import { Text, View } from "react-native";
import { CarWrenchIcon } from "@/components/state-icons";

/** Zodpovedá `.casker-logo` v dashboarde, mierne zväčšené pre mobil. */
const LOGO_FONT_SIZE = 28;
const ICON_SIZE = Math.round(LOGO_FONT_SIZE * 1.45);

export function CaskerLogo() {
  return (
    <View
      className="flex-row items-center"
      accessibilityRole="header"
      accessibilityLabel="cAsker"
    >
      <Text
        className="font-black text-white"
        style={{
          fontSize: LOGO_FONT_SIZE,
          letterSpacing: LOGO_FONT_SIZE * 0.025,
          lineHeight: LOGO_FONT_SIZE,
        }}
      >
        c
      </Text>
      <View style={{ marginHorizontal: -LOGO_FONT_SIZE * 0.04 }}>
        <CarWrenchIcon size={ICON_SIZE} color="#ffffff" />
      </View>
      <Text
        className="font-black text-white"
        style={{
          fontSize: LOGO_FONT_SIZE,
          letterSpacing: LOGO_FONT_SIZE * 0.025,
          lineHeight: LOGO_FONT_SIZE,
        }}
      >
        sker
      </Text>
    </View>
  );
}
