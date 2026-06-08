import { Linking, Modal, Pressable, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { SafeAreaView } from "react-native-safe-area-context";

import { buttonShadow } from "@/constants/button-shadow";
import { DRIVER_PROFILE } from "@/lib/driver-profile";
import { DRIVER_VEHICLES, formatVehicleSpecsSummary } from "@/lib/driver-vehicles";

type AccountPlaceholderScreenProps = {
  visible: boolean;
  onClose: () => void;
};

export function AccountPlaceholderScreen({ visible, onClose }: AccountPlaceholderScreenProps) {
  const phoneHref = DRIVER_PROFILE.phone.replace(/\s+/g, "");

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
        <View className="flex-row items-center border-b border-slate-200 px-4 py-3">
          <Pressable
            onPress={onClose}
            className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 active:opacity-80"
            style={buttonShadow}
          >
            <FontAwesome name="chevron-left" size={16} color="#0b194f" />
          </Pressable>
          <Text className="ml-3 text-xl font-bold text-casker-navy">Účet</Text>
        </View>

        <View className="flex-1 px-4 py-5">
          <View className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Kontakt
            </Text>
            <Text className="mt-2 text-lg font-bold text-casker-navy">
              {DRIVER_PROFILE.userName}
            </Text>
            <Pressable
              onPress={() => {
                void Linking.openURL(`tel:${phoneHref}`);
              }}
              className="mt-2 self-start active:opacity-80"
            >
              <Text className="text-base font-semibold text-blue-700">
                {DRIVER_PROFILE.phoneDisplay}
              </Text>
            </Pressable>
          </View>

          <Text className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Moje vozidlá
          </Text>
          <View className="mt-3 gap-2">
            {DRIVER_VEHICLES.map((vehicle) => (
              <View
                key={vehicle.id}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                style={buttonShadow}
              >
                <Text className="text-base font-semibold text-casker-navy">{vehicle.label}</Text>
                <Text className="mt-0.5 text-sm text-slate-500">EČ {vehicle.plate}</Text>
                <Text className="mt-1 text-xs leading-5 text-slate-600">
                  {formatVehicleSpecsSummary(vehicle)}
                </Text>
                <Text className="mt-0.5 text-xs text-slate-500">
                  {vehicle.fuelType} · {vehicle.transmission} · VIN {vehicle.vin}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
