import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { buttonShadow } from "@/constants/button-shadow";
import { COMPLETION_NOTIFICATION_TITLE } from "@/lib/driver-completion";
import type { DriverRequestSummary } from "@/lib/driver-requests-api";

type DriverRequestCompletionCardProps = {
  request: DriverRequestSummary;
  isConfirming?: boolean;
  onConfirmPress: () => void;
};

export function DriverRequestCompletionCard({
  request,
  isConfirming = false,
  onConfirmPress,
}: DriverRequestCompletionCardProps) {
  const completedWork = request.completedWork?.trim();
  const pickupNote = request.vehiclePickupNote?.trim();

  return (
    <View
      className="mt-3 rounded-2xl border border-green-200 bg-green-50 p-4"
      style={buttonShadow}
    >
      <Text className="text-base font-bold text-green-700">{COMPLETION_NOTIFICATION_TITLE}</Text>

      {completedWork ? (
        <Text className="mt-2 text-sm leading-5 text-green-900">{completedWork}</Text>
      ) : null}

      {pickupNote ? (
        <Text className="mt-2 text-sm leading-5 text-green-800">
          Prevzatie vozidla: {pickupNote}
        </Text>
      ) : null}

      <Pressable
        onPress={onConfirmPress}
        disabled={isConfirming}
        className="mt-4 items-center rounded-xl bg-green-700 py-3 active:opacity-90 disabled:opacity-60"
      >
        {isConfirming ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text className="text-sm font-bold text-white">Potvrdiť</Text>
        )}
      </Pressable>
    </View>
  );
}
