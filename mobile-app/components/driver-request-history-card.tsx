import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { RequestCategoryIcon } from "@/components/request-category-icon";
import { NotificationAlertIcon } from "@/components/notification-alert-icon";
import { buttonShadow } from "@/constants/button-shadow";
import { getDriverInquiryUserDescription } from "@/lib/driver-inquiry-description";
import {
  getDriverHistoryServiceAddress,
  getDriverHistoryServiceName,
} from "@/lib/driver-history";
import { getDriverRequestClosureMessage } from "@/lib/driver-request-closure";
import type { DriverRequestSummary } from "@/lib/driver-requests-api";

type DriverRequestHistoryCardProps = {
  request: DriverRequestSummary;
  hasUnseenNotification?: boolean;
  onAcknowledgeNotification?: (requestId: string) => void;
};

export function DriverRequestHistoryCard({
  request,
  hasUnseenNotification = false,
  onAcknowledgeNotification,
}: DriverRequestHistoryCardProps) {
  const [expanded, setExpanded] = useState(false);

  const completedWork = request.completedWork?.trim();
  const serviceName = getDriverHistoryServiceName(request);
  const serviceAddress = getDriverHistoryServiceAddress(request);
  const isCompleted = request.status === "completed";
  const isCancelled = request.status === "cancelled";
  const isExpired = request.status === "expired";
  const inquiryDescription = getDriverInquiryUserDescription(request.inquiryDescription ?? "");
  const closureMessage = getDriverRequestClosureMessage(request);

  const handlePress = () => {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);

    if (nextExpanded && hasUnseenNotification) {
      onAcknowledgeNotification?.(request.id);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${request.vehicleName} ${request.year}, história dopytu`}
      className={`rounded-2xl border bg-white active:opacity-95 ${
        expanded ? "border-[#6c9cbd] p-5" : "border-slate-200 p-4"
      }`}
      style={buttonShadow}
    >
      <View className="flex-row items-start gap-3">
        <RequestCategoryIcon category={request.requestCategory} />
        <View className="min-w-0 flex-1">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="flex-1 text-base font-bold text-casker-navy">
              {request.vehicleName} {request.year}
            </Text>
            <View className="flex-row items-center gap-2">
              {hasUnseenNotification ? <NotificationAlertIcon /> : null}
              <FontAwesome
                name={expanded ? "chevron-up" : "chevron-down"}
                size={14}
                color="#64748b"
                style={{ marginTop: 4 }}
              />
            </View>
          </View>
          <View className="mt-3 flex-row flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <View className="rounded-md bg-slate-100 px-2.5 py-1">
              <Text className="text-xs font-semibold text-casker-navy">
                EČ {request.licensePlate}
              </Text>
            </View>
            {isCancelled || isExpired ? (
              <View
                className={`rounded-md px-2.5 py-1 ${
                  isCancelled ? "bg-red-50" : "bg-amber-50"
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    isCancelled ? "text-red-700" : "text-amber-800"
                  }`}
                >
                  {isCancelled ? "Zrušené" : "Expirované"}
                </Text>
              </View>
            ) : null}
            <View className="flex-row items-center gap-1.5">
              <FontAwesome name="map-marker" size={14} color="#0b194f" />
              <Text className="text-sm font-medium text-casker-navy">{request.locationCity}</Text>
            </View>
          </View>
        </View>
      </View>

      {expanded ? (
        <View className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-4">
          {isCompleted ? (
            <>
              <Text className="text-sm font-bold text-casker-navy">
                Vykonané práce
              </Text>
              <Text className="mt-2 text-sm leading-6 text-slate-800">
                {completedWork || "Servis neuviedol popis vykonanej práce."}
              </Text>

              <Text className="mt-4 text-sm font-bold text-casker-navy">
                Servis
              </Text>
              <Text className="mt-2 text-sm font-semibold leading-6 text-slate-800">
                {serviceName || "Servis nebol určený."}
              </Text>
              {serviceAddress ? (
                <View className="mt-1.5 flex-row items-start gap-1.5">
                  <FontAwesome name="map-marker" size={13} color="#64748b" style={{ marginTop: 2 }} />
                  <Text className="flex-1 text-sm leading-5 text-slate-600">{serviceAddress}</Text>
                </View>
              ) : null}
            </>
          ) : (
            <>
              <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Stav
              </Text>
              <Text className="mt-2 text-sm font-semibold text-slate-700">
                {closureMessage ??
                  (isCancelled ? "Dopyt bol zrušený" : isExpired ? "Dopyt expiroval" : "Dopyt ukončený")}
              </Text>

              {serviceName ? (
                <>
                  <Text className="mt-4 text-sm font-bold text-casker-navy">
                    Servis
                  </Text>
                  <Text className="mt-2 text-sm font-semibold leading-6 text-slate-800">
                    {serviceName}
                  </Text>
                  {serviceAddress ? (
                    <View className="mt-1.5 flex-row items-start gap-1.5">
                      <FontAwesome
                        name="map-marker"
                        size={13}
                        color="#64748b"
                        style={{ marginTop: 2 }}
                      />
                      <Text className="flex-1 text-sm leading-5 text-slate-600">{serviceAddress}</Text>
                    </View>
                  ) : null}
                </>
              ) : null}

              {inquiryDescription ? (
                <>
                  <Text className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Popis dopytu
                  </Text>
                  <Text className="mt-2 text-sm leading-6 text-slate-700">{inquiryDescription}</Text>
                </>
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </Pressable>
  );
}
