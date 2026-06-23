import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
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

export const CALLOUT_WIDTH = 270;

type ServiceMapCalloutCardProps = {
  service: MapServiceMarker;
  onClose: () => void;
};

function formatPostDate(isoDate: string) {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("sk-SK");
}

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

export function ServiceMapCalloutCard({ service, onClose }: ServiceMapCalloutCardProps) {
  const [profile, setProfile] = useState<PublicServiceProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullProfileOpen, setFullProfileOpen] = useState(false);

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
      <View collapsable={false} style={styles.card}>
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
            onPress={handleNavigate}
            style={styles.navigateButton}
            accessibilityLabel="Navigovať do servisu"
          >
            <FontAwesome name="location-arrow" size={14} color="#ffffff" />
            <Text style={styles.navigateButtonText}>Navigovať</Text>
          </Pressable>
          <Pressable
            onPress={() => setFullProfileOpen(true)}
            style={styles.profileButton}
            accessibilityLabel={`Otvoriť profil servisu ${displayName}`}
          >
            <FontAwesome name="user" size={14} color="#0b194f" />
            <Text style={styles.profileButtonText}>Profil</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={fullProfileOpen}
        animationType="slide"
        onRequestClose={() => setFullProfileOpen(false)}
      >
        <View style={styles.modalRoot}>
          <SafeAreaView edges={["top"]} style={styles.modalHeader}>
            <Pressable
              onPress={() => setFullProfileOpen(false)}
              style={styles.modalClose}
              accessibilityLabel="Zavrieť profil"
            >
              <FontAwesome name="chevron-down" size={15} color="#ffffff" />
            </Pressable>

            <View style={styles.modalHeaderRow}>
              <View style={styles.modalLogoWrap}>
                <ServiceLogo logoDataUrl={profile?.logoDataUrl} size={72} />
              </View>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>{displayName}</Text>
                {addressLabel ? (
                  <Text style={styles.modalAddress}>{addressLabel}</Text>
                ) : null}
              </View>
            </View>

            <Pressable onPress={handleNavigate} style={styles.modalNavigate}>
              <FontAwesome name="location-arrow" size={14} color="#ffffff" />
              <Text style={styles.modalNavigateText}>Navigovať</Text>
            </Pressable>
          </SafeAreaView>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {profile?.about?.trim() ? (
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>O nás</Text>
                <Text style={styles.modalBody}>{profile.about}</Text>
              </View>
            ) : null}

            {profile && profile.services.length > 0 ? (
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Ponúkané služby</Text>
                <View style={styles.modalTags}>
                  {profile.services.map((item) => (
                    <View key={item} style={styles.modalTag}>
                      <Text style={styles.modalTagText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {profile && profile.posts.length > 0 ? (
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Naše práce</Text>
                {profile.posts.map((post) => (
                  <View key={post.id} style={styles.postCard}>
                    {post.description ? (
                      <Text style={styles.postDescription}>{post.description}</Text>
                    ) : null}
                    {formatPostDate(post.createdAt) ? (
                      <Text style={styles.postDate}>{formatPostDate(post.createdAt)}</Text>
                    ) : null}
                    {post.photos.map((photo, index) => (
                      <Image
                        key={`${post.id}-${index}`}
                        source={{ uri: photo }}
                        style={styles.postPhoto}
                        resizeMode="cover"
                      />
                    ))}
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CALLOUT_WIDTH,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 12,
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
  modalRoot: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  modalHeader: {
    backgroundColor: "#0b194f",
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    marginBottom: 12,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  modalLogoWrap: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  modalHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
  },
  modalAddress: {
    marginTop: 4,
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
  },
  modalNavigate: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingVertical: 10,
  },
  modalNavigateText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 48,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#0b194f",
  },
  modalBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#334155",
  },
  modalTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  modalTag: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modalTagText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0b194f",
  },
  postCard: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 16,
  },
  postDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: "#1e293b",
  },
  postDate: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "500",
    color: "#94a3b8",
  },
  postPhoto: {
    marginTop: 12,
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 12,
  },
});
