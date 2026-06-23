import { Alert, Pressable, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { NotificationAlertIcon } from "@/components/notification-alert-icon";
import { NotificationBadge } from "@/components/notification-badge";
import { buttonShadow } from "@/constants/button-shadow";
import type { DriverServiceResponse } from "@/lib/driver-requests-api";

type ServiceResponseCardProps = {
  response: DriverServiceResponse;
  rescheduleRequested?: boolean;
  onReject: () => void;
  onReschedule: () => void;
  onChat: () => void;
  onAccept: () => void;
  onFocusOnMap?: () => void;
  isMapFocused?: boolean;
  unreadChatCount?: number;
  isBusy?: boolean;
};

export function ServiceResponseCard({
  response,
  rescheduleRequested = false,
  onReject,
  onReschedule,
  onChat,
  onAccept,
  onFocusOnMap,
  isMapFocused = false,
  unreadChatCount = 0,
  isBusy = false,
}: ServiceResponseCardProps) {
  const isAccepted = response.status === "accepted";
  const showPendingAlert = response.status === "pending";
  const canFocusOnMap =
    onFocusOnMap !== undefined &&
    response.serviceLatitude !== null &&
    response.serviceLongitude !== null;

  const handleReject = () => {
    Alert.alert("Odmietnuť ponuku", "Naozaj chcete odmietnuť ponuku od tohto servisu?", [
      { text: "Nie", style: "cancel" },
      { text: "Áno", style: "destructive", onPress: onReject },
    ]);
  };

  const termStatusLabel = isAccepted
    ? "Potvrdený termín"
    : rescheduleRequested
      ? "Zažiadané o zmenu termínu"
      : "Navrhovaný termín";

  return (
    <View
      className={`relative rounded-2xl border bg-white p-4 ${
        isMapFocused ? "border-[#6c9cbd]" : isAccepted ? "border-green-200" : "border-slate-200"
      }`}
      style={buttonShadow}
    >
      <Pressable
        onPress={handleReject}
        disabled={isBusy || isAccepted}
        accessibilityLabel="Odmietnuť ponuku servisu"
        hitSlop={8}
        className="absolute right-3 top-3 z-10 h-8 w-8 items-center justify-center rounded-full active:bg-slate-100 disabled:opacity-40"
      >
        <FontAwesome name="times" size={18} color="#94a3b8" />
      </Pressable>

      <Pressable
        onPress={canFocusOnMap ? onFocusOnMap : undefined}
        disabled={!canFocusOnMap || isBusy}
        accessibilityRole="button"
        accessibilityLabel={`Zobraziť ${response.serviceName} na mape`}
        className="pr-8 active:opacity-80 disabled:opacity-100"
      >
        <Text className="text-base font-bold text-casker-navy">{response.serviceName}</Text>
        <View className="mt-1 flex-row items-start gap-1.5">
          <FontAwesome name="map-marker" size={13} color="#64748b" style={{ marginTop: 2 }} />
          <Text className="flex-1 text-sm leading-5 text-slate-600">{response.serviceAddress}</Text>
        </View>
      </Pressable>

      <Pressable
        onPress={canFocusOnMap ? onFocusOnMap : undefined}
        disabled={!canFocusOnMap || isBusy}
        className={`relative mt-4 rounded-xl px-3 py-3 active:opacity-100 disabled:opacity-100 ${
          isAccepted
            ? "bg-green-50 active:bg-green-50"
            : rescheduleRequested
              ? "bg-orange-50 active:bg-orange-50"
              : "bg-slate-50 active:bg-slate-100"
        }`}
      >
        {showPendingAlert ? (
          <View className="absolute right-2 top-2 z-10">
            <NotificationAlertIcon />
          </View>
        ) : null}
        <Text
          className={`text-xs font-semibold uppercase tracking-wide ${
            isAccepted
              ? "text-green-700"
              : rescheduleRequested
                ? "text-orange-700"
                : "text-slate-500"
          }`}
        >
          {termStatusLabel}
        </Text>
        {!rescheduleRequested || isAccepted ? (
          <Text
            className={`mt-1 text-base font-bold ${
              isAccepted ? "text-green-800" : "text-casker-navy"
            }`}
          >
            {response.scheduleLabel}
          </Text>
        ) : null}
      </Pressable>

      {response.message ? (
        <Text className="mt-3 text-sm leading-5 text-slate-600">{response.message}</Text>
      ) : null}

      <View className="mt-4 flex-row flex-wrap gap-2">
        <ActionButton
          label="Zmena termínu"
          onPress={onReschedule}
          disabled={isBusy || isAccepted || rescheduleRequested}
        />
        <ActionButton
          label="Chat"
          onPress={onChat}
          disabled={isBusy}
          badgeCount={unreadChatCount}
        />
        {!isAccepted ? (
          <ActionButton label="Prijať" onPress={onAccept} disabled={isBusy} primary />
        ) : null}
      </View>

      {isAccepted ? (
        <View
          pointerEvents="none"
          className="absolute bottom-4 right-4"
          accessibilityLabel="Termín potvrdený"
        >
          <FontAwesome name="check-circle" size={28} color="#15803d" />
        </View>
      ) : null}
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
  primary = false,
  badgeCount = 0,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  badgeCount?: number;
}) {
  return (
    <View className="relative">
      <Pressable
        onPress={onPress}
        disabled={disabled}
        className={`rounded-full border px-3 py-2 active:bg-slate-50 disabled:opacity-50 ${
          primary ? "border-casker-navy bg-white" : "border-slate-200 bg-white"
        }`}
      >
        <Text className={`text-xs font-semibold ${primary ? "text-casker-navy" : "text-slate-700"}`}>
          {label}
        </Text>
      </Pressable>
      {badgeCount > 0 ? (
        <View className="absolute -right-1 -top-1">
          <NotificationBadge count={badgeCount} size="sm" />
        </View>
      ) : null}
    </View>
  );
}
