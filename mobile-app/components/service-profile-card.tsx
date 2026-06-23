import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { SafeAreaView } from "react-native-safe-area-context";

import type { MapServiceMarker } from "@/lib/map-services-api";
import {
  fetchPublicServiceProfile,
  type PublicServiceProfile,
} from "@/lib/service-profile-api";

type ServiceProfileCardProps = {
  service: MapServiceMarker;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onClose: () => void;
  /** Vodorovná pozícia pinu vo vnútri karty — tam ukazuje chvostík bubliny. */
  tailOffsetX?: number;
  /** Zvýšenie hodnoty spustí plynulé zatvorenie karty (klik do mapy). */
  closeToken?: number;
};

function ServiceLogo({
  logoDataUrl,
  size,
  borderRadius = 12,
}: {
  logoDataUrl: string | null | undefined;
  size: number;
  borderRadius?: number;
}) {
  if (logoDataUrl) {
    return (
      <Image
        source={{ uri: logoDataUrl }}
        style={{ width: size, height: size, borderRadius }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      className="items-center justify-center bg-slate-100"
      style={{ width: size, height: size, borderRadius }}
    >
      <FontAwesome name="wrench" size={size * 0.45} color="#94a3b8" />
    </View>
  );
}

function formatPostDate(isoDate: string) {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("sk-SK");
}

export function ServiceProfileCard({
  service,
  expanded,
  onExpandedChange,
  onClose,
  tailOffsetX,
  closeToken = 0,
}: ServiceProfileCardProps) {
  const [profile, setProfile] = useState<PublicServiceProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullProfileOpen, setFullProfileOpen] = useState(false);

  const appear = useRef(new Animated.Value(0)).current;
  const expand = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  /* Pin sa po kliknutí viditeľne zväčšuje a plynule "premení" na kartu */
  useEffect(() => {
    appear.setValue(0);
    Animated.timing(appear, {
      toValue: 1,
      duration: 420,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
  }, [appear, service.id]);

  /* Pri zavretí sa karta stiahne späť do pinu a až potom zmizne */
  const handleRequestClose = () => {
    Animated.timing(appear, {
      toValue: 0,
      duration: 260,
      easing: Easing.bezier(0.4, 0, 0.6, 1),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        onClose();
      }
    });
  };

  /* Klik kamkoľvek do mapy → plynulé zatvorenie */
  const lastCloseToken = useRef(closeToken);
  useEffect(() => {
    if (closeToken > lastCloseToken.current) {
      lastCloseToken.current = closeToken;
      handleRequestClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeToken]);

  /* Plynulé zväčšenie bublinky na kartu a späť */
  useEffect(() => {
    Animated.timing(expand, {
      toValue: expanded ? 1 : 0,
      duration: 260,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: false,
    }).start();
  }, [expand, expanded]);

  useEffect(() => {
    let cancelled = false;

    setProfile(null);
    setError(null);
    setIsLoading(true);

    fetchPublicServiceProfile(service.id)
      .then((loaded) => {
        if (!cancelled) {
          setProfile(loaded);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Profil servisu sa nepodarilo načítať.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [service.id]);

  const displayName = profile?.displayName || service.companyName;
  const addressLabel = [service.address, service.city]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");

  const handleNavigate = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${service.latitude},${service.longitude}`;
    void Linking.openURL(url);
  };

  const growOriginX = tailOffsetX ?? 135;

  return (
    <>
      <Animated.View
        style={{
          opacity: appear.interpolate({
            inputRange: [0, 0.15, 1],
            outputRange: [0, 1, 1],
          }),
          /* Karta rastie smerom hore zo spodného hrotu značky */
          transformOrigin: [growOriginX, "100%", 0],
          transform: [
            {
              scaleX: appear.interpolate({
                inputRange: [0, 1],
                outputRange: [0.35, 1],
              }),
            },
            {
              scaleY: appear.interpolate({
                inputRange: [0, 1],
                outputRange: [0.12, 1],
              }),
            },
          ],
          borderRadius: 18,
          borderWidth: 1,
          borderColor: "#e2e8f0",
          backgroundColor: "#ffffff",
          paddingHorizontal: 14,
          paddingVertical: 12,
          shadowColor: "#0f172a",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.18,
          shadowRadius: 14,
          elevation: 8,
        }}
      >
        <Pressable
          onPress={handleRequestClose}
          className="absolute right-2.5 top-2.5 z-10 h-7 w-7 items-center justify-center rounded-full bg-slate-100 active:bg-slate-200"
          accessibilityLabel="Zavrieť"
        >
          <FontAwesome name="times" size={14} color="#64748b" />
        </Pressable>

        {/* Hlavička bublinky — kliknutím sa karta rozbalí / zbalí */}
        <Pressable
          onPress={() => onExpandedChange(!expanded)}
          className="flex-row items-center gap-3 pr-8 active:opacity-80"
          accessibilityLabel={
            expanded ? "Zbaliť kartu servisu" : `Rozbaliť kartu servisu ${displayName}`
          }
        >
          <ServiceLogo logoDataUrl={profile?.logoDataUrl} size={44} />
          <View className="min-w-0 flex-1">
            <Text className="text-base font-bold text-casker-navy" numberOfLines={1}>
              {displayName}
            </Text>
            {addressLabel ? (
              <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={1}>
                {addressLabel}
              </Text>
            ) : null}
          </View>
        </Pressable>

        {/* Rozbalená časť */}
        <Animated.View
          style={{
            opacity: expand,
            maxHeight: expand.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 440],
            }),
            overflow: "hidden",
          }}
        >
          <View className="pt-3">
            {isLoading ? (
              <View className="flex-row items-center gap-2 py-1">
                <ActivityIndicator size="small" color="#0b194f" />
                <Text className="text-xs text-slate-500">Načítavam profil…</Text>
              </View>
            ) : error ? (
              <Text className="py-1 text-xs text-slate-400">{error}</Text>
            ) : profile && profile.services.length > 0 ? (
              <View className="flex-row flex-wrap gap-1.5">
                {profile.services.slice(0, 6).map((item) => (
                  <View
                    key={item}
                    className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1"
                  >
                    <Text className="text-[11px] font-semibold text-casker-navy">
                      {item}
                    </Text>
                  </View>
                ))}
                {profile.services.length > 6 ? (
                  <View className="rounded-full bg-slate-100 px-2.5 py-1">
                    <Text className="text-[11px] font-semibold text-slate-500">
                      +{profile.services.length - 6}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View className="mt-3 gap-2">
              <Pressable
                onPress={handleNavigate}
                className="flex-row items-center justify-center gap-2 rounded-xl bg-casker-navy py-2.5 active:opacity-90"
                accessibilityLabel="Navigovať do servisu"
              >
                <FontAwesome name="location-arrow" size={14} color="#ffffff" />
                <Text className="text-sm font-bold text-white">Navigovať</Text>
              </Pressable>
              <Pressable
                onPress={() => setFullProfileOpen(true)}
                className="flex-row items-center justify-center gap-2 rounded-xl border border-casker-navy py-2.5 active:bg-slate-50"
                accessibilityLabel={`Otvoriť profil servisu ${displayName}`}
              >
                <FontAwesome name="user" size={14} color="#0b194f" />
                <Text className="text-sm font-bold text-casker-navy">Profil</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Celý profil servisu */}
      <Modal
        visible={fullProfileOpen}
        animationType="slide"
        onRequestClose={() => setFullProfileOpen(false)}
      >
        <View className="flex-1 bg-white">
          <SafeAreaView edges={["top"]} className="bg-casker-navy">
            <View className="px-5 pb-5 pt-3">
              <Pressable
                onPress={() => setFullProfileOpen(false)}
                className="mb-3 h-9 w-9 items-center justify-center rounded-full bg-white/15 active:bg-white/25"
                accessibilityLabel="Zavrieť profil"
              >
                <FontAwesome name="chevron-down" size={15} color="#ffffff" />
              </Pressable>

              <View className="flex-row items-center gap-4">
                <View className="overflow-hidden rounded-2xl border-2 border-white/30 bg-white">
                  <ServiceLogo logoDataUrl={profile?.logoDataUrl} size={72} borderRadius={14} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-xl font-bold text-white">{displayName}</Text>
                  {addressLabel ? (
                    <Text className="mt-1 text-sm text-white/70">{addressLabel}</Text>
                  ) : null}
                </View>
              </View>

              <Pressable
                onPress={handleNavigate}
                className="mt-4 flex-row items-center justify-center gap-2 rounded-xl bg-white/15 py-2.5 active:bg-white/25"
                accessibilityLabel="Navigovať do servisu"
              >
                <FontAwesome name="location-arrow" size={14} color="#ffffff" />
                <Text className="text-sm font-bold text-white">Navigovať</Text>
              </Pressable>
            </View>
          </SafeAreaView>

          <ScrollView
            className="flex-1"
            contentContainerClassName="px-5 pb-12 pt-5"
            showsVerticalScrollIndicator={false}
          >
            {profile?.about?.trim() ? (
              <View className="mb-6">
                <Text className="text-xs font-bold uppercase tracking-wide text-casker-navy">
                  O nás
                </Text>
                <Text className="mt-2 text-sm leading-5 text-slate-700">
                  {profile.about}
                </Text>
              </View>
            ) : null}

            {profile && profile.services.length > 0 ? (
              <View className="mb-6">
                <Text className="text-xs font-bold uppercase tracking-wide text-casker-navy">
                  Ponúkané služby
                </Text>
                <View className="mt-2 flex-row flex-wrap gap-2">
                  {profile.services.map((item) => (
                    <View
                      key={item}
                      className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5"
                    >
                      <Text className="text-xs font-semibold text-casker-navy">{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {profile && profile.posts.length > 0 ? (
              <View>
                <Text className="text-xs font-bold uppercase tracking-wide text-casker-navy">
                  Naše práce
                </Text>
                {profile.posts.map((post) => (
                  <View
                    key={post.id}
                    className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    {post.description ? (
                      <Text className="text-sm leading-5 text-slate-800">
                        {post.description}
                      </Text>
                    ) : null}
                    {formatPostDate(post.createdAt) ? (
                      <Text className="mt-1 text-[11px] font-medium text-slate-400">
                        {formatPostDate(post.createdAt)}
                      </Text>
                    ) : null}

                    {post.photos.map((photo, index) => (
                      <Image
                        key={`${post.id}-${index}`}
                        source={{ uri: photo }}
                        className="mt-3 w-full rounded-xl"
                        style={{ aspectRatio: 4 / 3 }}
                        resizeMode="cover"
                      />
                    ))}
                  </View>
                ))}
              </View>
            ) : null}

            {profile &&
            !profile.about?.trim() &&
            profile.services.length === 0 &&
            profile.posts.length === 0 ? (
              <View className="items-center py-16">
                <FontAwesome name="info-circle" size={28} color="#cbd5e1" />
                <Text className="mt-3 text-center text-sm text-slate-400">
                  Tento servis si zatiaľ nevyplnil profil.
                </Text>
              </View>
            ) : null}

            {isLoading ? (
              <View className="items-center py-16">
                <ActivityIndicator size="large" color="#0b194f" />
              </View>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
