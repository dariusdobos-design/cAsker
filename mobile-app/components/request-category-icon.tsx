import FontAwesome from "@expo/vector-icons/FontAwesome";
import { View } from "react-native";

import { TowingServiceIcon, WideServiceIcon } from "@/components/service-category-icons";
import type { RequestCategoryId } from "@/lib/request-category";

type RequestCategoryIconProps = {
  category: RequestCategoryId;
  size?: number;
  color?: string;
};

export function RequestCategoryIcon({
  category,
  size = 24,
  color = "#0b194f",
}: RequestCategoryIconProps) {
  return (
    <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100">
      {category === "tire" ? (
        <WideServiceIcon size={size} color={color} />
      ) : category === "towing" ? (
        <TowingServiceIcon size={size} color={color} />
      ) : (
        <FontAwesome name="wrench" size={size - 2} color={color} />
      )}
    </View>
  );
}
