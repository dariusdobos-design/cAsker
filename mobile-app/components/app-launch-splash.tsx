import { View, type LayoutChangeEvent } from "react-native";
import { StatusBar } from "expo-status-bar";

import { CaskerLogo } from "@/components/casker-logo";

type AppLaunchSplashProps = {
  onVisible?: () => void;
};

export function AppLaunchSplash({ onVisible }: AppLaunchSplashProps) {
  const handleLayout = (_event: LayoutChangeEvent) => {
    onVisible?.();
  };

  return (
    <View
      className="flex-1 items-center justify-center bg-casker-navy"
      onLayout={handleLayout}
    >
      <StatusBar style="light" />
      <CaskerLogo size="splash" />
    </View>
  );
}
