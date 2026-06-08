import { Alert, View } from "react-native";

import { DriverRequestCard } from "@/components/driver-request-card";
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
  canCancelRequest?: boolean;
  onCancelRequest?: () => void;
  onUpdated: () => void;
  busyResponseId?: string | null;
  onBusyChange?: (appointmentId: string | null) => void;
  onServiceFocus?: (response: DriverServiceResponse) => void;
  focusedServiceResponseId?: string | null;
  onOpenChat?: (serviceName: string) => void;
};

export function DriverRequestThread({
  request,
  canCancelRequest = false,
  onCancelRequest,
  onUpdated,
  busyResponseId = null,
  onBusyChange,
  onServiceFocus,
  focusedServiceResponseId = null,
  onOpenChat,
}: DriverRequestThreadProps) {
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

  const handleReschedule = async () => {
    try {
      await requestDriverReschedule(request.id);
      Alert.alert(
        "Žiadosť odoslaná",
        "Servis bol informovaný, že žiadate o iný termín. Očakávajte novú ponuku.",
      );
      onUpdated();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Žiadosť o zmenu termínu sa nepodarilo odoslať.";
      Alert.alert("Chyba", message);
    }
  };

  return (
    <View className="gap-0">
      <DriverRequestCard
        request={request}
        canCancel={canCancelRequest}
        onCancelPress={onCancelRequest}
      />

      {request.serviceResponses.length > 0 ? (
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
