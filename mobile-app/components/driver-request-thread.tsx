import { Alert, View } from "react-native";

import { DriverRequestCard } from "@/components/driver-request-card";
import { DriverRequestCompletionCard } from "@/components/driver-request-completion-card";
import { DriverRequestHistoryCard } from "@/components/driver-request-history-card";
import { ServiceResponseCard } from "@/components/service-response-card";
import {
  acceptDriverServiceResponse,
  rejectDriverServiceResponse,
  requestDriverReschedule,
  type DriverRequestSummary,
  type DriverServiceResponse,
} from "@/lib/driver-requests-api";

type DriverRequestThreadProps = {
  request: DriverRequestSummary;
  mode: "active" | "received" | "history";
  canCancelRequest?: boolean;
  isConfirmingPickup?: boolean;
  onConfirmPickup?: () => void;
  onCancelRequest?: () => void;
  onUpdated: () => void;
  busyResponseId?: string | null;
  onBusyChange?: (appointmentId: string | null) => void;
  onServiceFocus?: (response: DriverServiceResponse) => void;
  focusedServiceResponseId?: string | null;
  onOpenChat?: (serviceName: string) => void;
  hasUnseenHistoryNotification?: boolean;
  onAcknowledgeHistoryNotification?: (requestId: string) => void;
};

export function DriverRequestThread({
  request,
  mode,
  canCancelRequest = false,
  isConfirmingPickup = false,
  onConfirmPickup,
  onCancelRequest,
  onUpdated,
  busyResponseId = null,
  onBusyChange,
  onServiceFocus,
  focusedServiceResponseId = null,
  onOpenChat,
  hasUnseenHistoryNotification = false,
  onAcknowledgeHistoryNotification,
}: DriverRequestThreadProps) {
  const showCompletionCard = mode === "received";

  if (mode === "history") {
    return (
      <DriverRequestHistoryCard
        request={request}
        hasUnseenNotification={hasUnseenHistoryNotification}
        onAcknowledgeNotification={onAcknowledgeHistoryNotification}
      />
    );
  }

  const handleAccept = async (appointmentId: string) => {
    onBusyChange?.(appointmentId);
    try {
      await acceptDriverServiceResponse(appointmentId);
      onUpdated();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Termín sa nepodarilo prijať.";
      Alert.alert("Chyba", message);
    } finally {
      onBusyChange?.(null);
    }
  };

  const handleReject = async (appointmentId: string) => {
    onBusyChange?.(appointmentId);
    try {
      await rejectDriverServiceResponse(appointmentId);
      onUpdated();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ponuku sa nepodarilo odmietnuť.";
      Alert.alert("Chyba", message);
    } finally {
      onBusyChange?.(null);
    }
  };

  const handleReschedule = () => {
    if (request.rescheduleRequestedAt) {
      return;
    }

    Alert.alert("Zažiadať o zmenu termínu?", "Servis bude informovaný, že žiadate o iný termín.", [
      { text: "Zrušiť", style: "cancel" },
      {
        text: "Potvrdiť",
        onPress: () => {
          void (async () => {
            try {
              await requestDriverReschedule(request.id);
              onUpdated();
            } catch (error) {
              const message =
                error instanceof Error
                  ? error.message
                  : "Žiadosť o zmenu termínu sa nepodarilo odoslať.";
              Alert.alert("Chyba", message);
            }
          })();
        },
      },
    ]);
  };

  const rescheduleRequested = Boolean(request.rescheduleRequestedAt);

  return (
    <View className="gap-0">
      <DriverRequestCard
        request={request}
        canCancel={canCancelRequest}
        onCancelPress={onCancelRequest}
      />

      {showCompletionCard && onConfirmPickup ? (
        <DriverRequestCompletionCard
          request={request}
          isConfirming={isConfirmingPickup}
          onConfirmPress={onConfirmPickup}
        />
      ) : null}

      {mode === "active" && request.serviceResponses.length > 0 ? (
        <View className="mt-1 pl-5">
          {request.serviceResponses.map((response, index) => (
            <View key={response.id} className="flex-row gap-3">
              <View className="w-4 items-center">
                <View className="mt-2 h-3 w-0.5 bg-slate-200" />
                <View className="h-2.5 w-2.5 rounded-full border-2 border-slate-300 bg-white" />
                {index < request.serviceResponses.length - 1 ? (
                  <View className="mt-1 w-0.5 flex-1 bg-slate-200" />
                ) : (
                  <View className="h-3 w-0.5 bg-transparent" />
                )}
              </View>

              <View className="mb-3 flex-1">
                <ServiceResponseCard
                  response={response}
                  rescheduleRequested={rescheduleRequested}
                  isBusy={busyResponseId === response.id}
                  isMapFocused={focusedServiceResponseId === response.id}
                  unreadChatCount={request.unreadChatCount}
                  onFocusOnMap={
                    onServiceFocus
                      ? () => {
                          onServiceFocus(response);
                        }
                      : undefined
                  }
                  onReject={() => {
                    void handleReject(response.id);
                  }}
                  onReschedule={() => {
                    void handleReschedule();
                  }}
                  onChat={() => {
                    onOpenChat?.(response.serviceName);
                  }}
                  onAccept={() => {
                    Alert.alert("Prijať termín", "Naozaj chcete prijať navrhovaný termín?", [
                      { text: "Nie", style: "cancel" },
                      {
                        text: "Prijať",
                        onPress: () => {
                          void handleAccept(response.id);
                        },
                      },
                    ]);
                  }}
                />
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
