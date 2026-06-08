import FontAwesome from "@expo/vector-icons/FontAwesome";
import type { ComponentProps } from "react";
import { View } from "react-native";

import type { RequestCategoryId } from "@/lib/request-category";

const CATEGORY_ICON: Record<
  RequestCategoryId,
  ComponentProps<typeof FontAwesome>["name"]
> = {
  auto: "wrench",
  tire: "circle",
  towing: "truck",
};

type RequestCategoryIconProps = {
  category: RequestCategoryId;
  size?: number;
  color?: string;
};

export function RequestCategoryIcon({
  category,
  size = 22,
  color = "#0b194f",
}: RequestCategoryIconProps) {
  return (
    <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100">
      <FontAwesome name={CATEGORY_ICON[category]} size={size} color={color} />
    </View>
  );
}
