import { Modal, Pressable, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { SafeAreaView } from "react-native-safe-area-context";

import { buttonShadow } from "@/constants/button-shadow";

type MenuPlaceholderScreenProps = {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
};

export function MenuPlaceholderScreen({
  visible,
  title,
  message,
  onClose,
}: MenuPlaceholderScreenProps) {
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
          <Text className="ml-3 text-xl font-bold text-casker-navy">{title}</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-base text-slate-600">{message}</Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
