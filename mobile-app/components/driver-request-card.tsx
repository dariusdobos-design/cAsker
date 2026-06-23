import { useState } from "react";
import { Image, Modal, Pressable, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { RequestCategoryIcon } from "@/components/request-category-icon";
import { buttonShadow } from "@/constants/button-shadow";
import { getDriverInquiryUserDescription } from "@/lib/driver-inquiry-description";
import type { DriverRequestSummary } from "@/lib/driver-requests-api";
import { getRequestCategoryLabel } from "@/lib/request-category";

type DriverRequestCardProps = {
  request: DriverRequestSummary;
  canCancel?: boolean;
  onCancelPress?: () => void;
};

const PHOTO_THUMB_SIZE = 64;

export function DriverRequestCard({
  request,
  canCancel = false,
  onCancelPress,
}: DriverRequestCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [activePhoto, setActivePhoto] = useState<string | null>(null);

  const description = getDriverInquiryUserDescription(request.inquiryDescription ?? "");
  const photos = request.inquiryPhotos ?? [];
  const categoryLabel = getRequestCategoryLabel(request.requestCategory);
  const hasLongDescription = description.length > 72 || description.includes("\n");
  const isExpandable = hasLongDescription || photos.length > 0;

  const toggleExpanded = () => {
    if (isExpandable) {
      setExpanded((value) => !value);
    }
  };

  return (
    <>
      <Pressable
        onPress={toggleExpanded}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${request.vehicleName} ${request.year}, ${categoryLabel}`}
        className={`rounded-2xl border bg-white active:opacity-95 ${
          expanded ? "border-[#6c9cbd] p-5" : "border-slate-200 p-4"
        }`}
        style={buttonShadow}
      >
        {canCancel && onCancelPress ? (
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onCancelPress();
            }}
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

            <View className="mt-2 self-start rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1">
              <Text className="text-[11px] font-semibold text-casker-navy">{categoryLabel}</Text>
            </View>

            {description ? (
              <Text
                className="mt-2 text-sm font-semibold leading-5 text-red-600"
                numberOfLines={expanded ? undefined : 3}
                ellipsizeMode="tail"
              >
                {description}
              </Text>
            ) : null}

            {expanded && photos.length > 0 ? (
              <View className="mt-3 flex-row flex-wrap gap-2">
                {photos.map((photo, index) => (
                  <Pressable
                    key={`${index}-${photo.slice(-16)}`}
                    onPress={(event) => {
                      event.stopPropagation();
                      setActivePhoto(photo);
                    }}
                    accessibilityLabel={`Zväčšiť fotku ${index + 1}`}
                    className="overflow-hidden rounded-lg border border-slate-200 active:opacity-90"
                    style={{ width: PHOTO_THUMB_SIZE, height: PHOTO_THUMB_SIZE }}
                  >
                    <Image
                      source={{ uri: photo }}
                      style={{ width: PHOTO_THUMB_SIZE, height: PHOTO_THUMB_SIZE }}
                      resizeMode="cover"
                    />
                  </Pressable>
                ))}
              </View>
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

        {isExpandable ? (
          <View className="mt-2 items-center">
            <FontAwesome
              name={expanded ? "chevron-up" : "chevron-down"}
              size={14}
              color="#64748b"
            />
          </View>
        ) : null}
      </Pressable>

      <Modal
        visible={activePhoto !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActivePhoto(null)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/85 px-4"
          onPress={() => setActivePhoto(null)}
        >
          {activePhoto ? (
            <Image
              source={{ uri: activePhoto }}
              className="w-full"
              style={{ height: "75%" }}
              resizeMode="contain"
            />
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}
