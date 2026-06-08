import { Pressable, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { RequestCategoryIcon } from "@/components/request-category-icon";
import { buttonShadow } from "@/constants/button-shadow";
import {
  getDriverInquiryUserDescription,
  truncateDriverInquiryCardDescription,
} from "@/lib/driver-inquiry-description";
import type { DriverRequestSummary } from "@/lib/driver-requests-api";

type DriverRequestCardProps = {
  request: DriverRequestSummary;
  canCancel?: boolean;
  onCancelPress?: () => void;
};

export function DriverRequestCard({
  request,
  canCancel = false,
  onCancelPress,
}: DriverRequestCardProps) {
  const description = truncateDriverInquiryCardDescription(
    getDriverInquiryUserDescription(request.inquiryDescription ?? ""),
  );

  return (
    <View
      className="rounded-2xl border border-slate-200 bg-white p-4"
      style={buttonShadow}
    >
      {canCancel && onCancelPress ? (
        <Pressable
          onPress={onCancelPress}
          accessibilityLabel="Zrušiť dopyt"
          hitSlop={8}
          className="absolute right-3 top-3 z-10 h-8 w-8 items-center justify-center rounded-full active:bg-slate-100"
        >
          <FontAwesome name="times" size={18} color="#94a3b8" />
        </Pressable>
      ) : null}

      <View className={`flex-row items-start gap-3 ${canCancel ? "pr-8" : ""}`}>
        <RequestCategoryIcon category={request.requestCategory} />
        <View className="min-w-0 flex-1">
          <Text className="text-base font-bold text-casker-navy">
            {request.vehicleName} {request.year}
          </Text>
          {description ? (
            <Text className="mt-0.5 text-sm font-semibold text-red-600">{description}</Text>
          ) : null}
        </View>
      </View>

      <View className="mt-4 flex-row flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <View className="rounded-md bg-slate-100 px-2.5 py-1">
          <Text className="text-xs font-semibold text-casker-navy">
            EČ {request.licensePlate}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <FontAwesome name="map-marker" size={14} color="#0b194f" />
          <Text className="text-sm font-medium text-casker-navy">{request.locationCity}</Text>
        </View>
      </View>
    </View>
  );
}
