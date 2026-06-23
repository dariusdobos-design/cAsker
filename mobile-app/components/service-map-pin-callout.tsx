import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import type { MapServiceMarker } from "@/lib/map-services-api";
import {
  fetchPublicServiceProfile,
  type PublicServiceProfile,
} from "@/lib/service-profile-api";

export const PIN_CALLOUT_WIDTH = 270;
const TAIL_HEIGHT = 14;

type ServiceMapPinCalloutProps = {
  service: MapServiceMarker;
  onClose: () => void;
  onOpenProfile: () => void;
  onSendInquiry: () => void;
};

function ServiceLogo({
  logoDataUrl,
  size,
}: {
  logoDataUrl: string | null | undefined;
  size: number;
}) {
  if (logoDataUrl) {
    return (
      <Image
        source={{ uri: logoDataUrl }}
        style={{ width: size, height: size, borderRadius: 12 }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View style={[styles.logoFallback, { width: size, height: size }]}>
      <FontAwesome name="wrench" size={size * 0.45} color="#94a3b8" />
    </View>
  );
}

function CalloutTail() {
  return (
    <View style={styles.tailWrap}>
      <View style={styles.tailOutline} />
      <View style={styles.tailFill} />
    </View>
  );
}

export function ServiceMapPinCallout({
  service,
  onClose,
  onOpenProfile,
  onSendInquiry,
}: ServiceMapPinCalloutProps) {
  const [profile, setProfile] = useState<PublicServiceProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setProfile(null);
    setError(null);
    setIsLoading(true);

    fetchPublicServiceProfile(service.id)
      .then((loaded) => {
        if (!cancelled) setProfile(loaded);
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
        if (!cancelled) setIsLoading(false);
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

  return (
    <>
      <View collapsable={false} style={styles.root}>
        <View style={styles.card}>
          <Pressable onPress={onClose} style={styles.closeButton} accessibilityLabel="Zavrieť">
            <FontAwesome name="times" size={14} color="#64748b" />
          </Pressable>

          <View style={styles.headerRow}>
            <ServiceLogo logoDataUrl={profile?.logoDataUrl} size={44} />
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={1}>
                {displayName}
              </Text>
              {addressLabel ? (
                <Text style={styles.address} numberOfLines={1}>
                  {addressLabel}
                </Text>
              ) : null}
            </View>
          </View>

          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#0b194f" />
              <Text style={styles.loadingText}>Načítavam profil…</Text>
            </View>
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : profile && profile.services.length > 0 ? (
            <View style={styles.tagsRow}>
              {profile.services.slice(0, 6).map((item) => (
                <View key={item} style={styles.tag}>
                  <Text style={styles.tagText}>{item}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={onSendInquiry}
              style={styles.inquiryButton}
              accessibilityLabel={`Poslať dopyt pre ${displayName}`}
            >
              <FontAwesome name="paper-plane" size={14} color="#ffffff" />
              <Text style={styles.inquiryButtonText}>Poslať dopyt</Text>
            </Pressable>
            <Pressable
              onPress={handleNavigate}
              style={styles.navigateButton}
              accessibilityLabel="Navigovať do servisu"
            >
              <FontAwesome name="location-arrow" size={14} color="#ffffff" />
              <Text style={styles.navigateButtonText}>Navigovať</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onOpenProfile();
              }}
              style={styles.profileButton}
              accessibilityLabel={`Otvoriť profil servisu ${displayName}`}
            >
              <FontAwesome name="user" size={14} color="#0b194f" />
              <Text style={styles.profileButtonText}>Profil</Text>
            </Pressable>
          </View>
        </View>

        <CalloutTail />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    width: PIN_CALLOUT_WIDTH,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  card: {
    width: PIN_CALLOUT_WIDTH,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...(Platform.OS === "android"
      ? {}
      : {
          shadowColor: "#0f172a",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.18,
          shadowRadius: 14,
        }),
  },
  tailWrap: {
    width: PIN_CALLOUT_WIDTH,
    height: TAIL_HEIGHT,
    alignItems: "center",
    marginTop: -1,
  },
  tailOutline: {
    width: 0,
    height: 0,
    borderLeftWidth: 13,
    borderRightWidth: 13,
    borderTopWidth: TAIL_HEIGHT,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#e2e8f0",
  },
  tailFill: {
    position: "absolute",
    top: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: TAIL_HEIGHT - 1,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#ffffff",
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingRight: 28,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0b194f",
  },
  address: {
    marginTop: 2,
    fontSize: 12,
    color: "#64748b",
  },
  logoFallback: {
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  loadingText: {
    fontSize: 12,
    color: "#64748b",
  },
  errorText: {
    marginTop: 12,
    fontSize: 12,
    color: "#94a3b8",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
  },
  tag: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0b194f",
  },
  actions: {
    marginTop: 12,
    gap: 8,
  },
  inquiryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: "#2563eb",
    paddingVertical: 10,
  },
  inquiryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  navigateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: "#0b194f",
    paddingVertical: 10,
  },
  navigateButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  profileButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#0b194f",
    paddingVertical: 10,
  },
  profileButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0b194f",
  },
});
