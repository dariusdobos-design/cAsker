import { Text, View } from "react-native";
import { CarWrenchIcon } from "@/components/state-icons";

const LOGO_SIZES = {
  default: 28,
  splash: 44,
} as const;

type CaskerLogoProps = {
  size?: keyof typeof LOGO_SIZES;
};

export function CaskerLogo({ size = "default" }: CaskerLogoProps) {
  const logoFontSize = LOGO_SIZES[size];
  const iconSize = Math.round(logoFontSize * 1.45);

  return (
    <View
      className="flex-row items-center"
      accessibilityRole="header"
      accessibilityLabel="cAsker"
    >
      <Text
        className="font-black text-white"
        style={{
          fontSize: logoFontSize,
          letterSpacing: logoFontSize * 0.025,
          lineHeight: logoFontSize,
        }}
      >
        c
      </Text>
      <View style={{ marginHorizontal: -logoFontSize * 0.04 }}>
        <CarWrenchIcon size={iconSize} color="#ffffff" />
      </View>
      <Text
        className="font-black text-white"
        style={{
          fontSize: logoFontSize,
          letterSpacing: logoFontSize * 0.025,
          lineHeight: logoFontSize,
        }}
      >
        sker
      </Text>
    </View>
  );
}
