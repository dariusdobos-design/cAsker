import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
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

type ServiceFullProfileModalProps = {
  visible: boolean;
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
        style={{ width: size, height: size, borderRadius: 14 }}
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

export function ServiceFullProfileModal({
  visible,
  service,
  onClose,
}: ServiceFullProfileModalProps) {
  const [profile, setProfile] = useState<PublicServiceProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }

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
  }, [service.id, visible]);

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
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      statusBarTranslucent={Platform.OS === "android"}
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <SafeAreaView edges={["top"]} style={styles.header}>
          <Pressable
            onPress={onClose}
            style={styles.closeButton}
            accessibilityLabel="Zavrieť profil"
          >
            <FontAwesome name="chevron-down" size={15} color="#ffffff" />
          </Pressable>

          <View style={styles.headerRow}>
            <View style={styles.logoWrap}>
              <ServiceLogo logoDataUrl={profile?.logoDataUrl} size={72} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>{displayName}</Text>
              {addressLabel ? <Text style={styles.address}>{addressLabel}</Text> : null}
            </View>
          </View>

          <Pressable onPress={handleNavigate} style={styles.navigateButton}>
            <FontAwesome name="location-arrow" size={14} color="#ffffff" />
            <Text style={styles.navigateButtonText}>Navigovať</Text>
          </Pressable>
        </SafeAreaView>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={styles.centeredState}>
              <ActivityIndicator size="large" color="#0b194f" />
            </View>
          ) : error ? (
            <View style={styles.centeredState}>
              <FontAwesome name="exclamation-circle" size={28} color="#cbd5e1" />
              <Text style={styles.emptyText}>{error}</Text>
            </View>
          ) : (
            <>
              {profile?.about?.trim() ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>O nás</Text>
                  <Text style={styles.bodyText}>{profile.about}</Text>
                </View>
              ) : null}

              {profile && profile.services.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Ponúkané služby</Text>
                  <View style={styles.tags}>
                    {profile.services.map((item) => (
                      <View key={item} style={styles.tag}>
                        <Text style={styles.tagText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {profile && profile.posts.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Naše práce</Text>
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

              {profile &&
              !profile.about?.trim() &&
              profile.services.length === 0 &&
              profile.posts.length === 0 ? (
                <View style={styles.centeredState}>
                  <FontAwesome name="info-circle" size={28} color="#cbd5e1" />
                  <Text style={styles.emptyText}>Tento servis si zatiaľ nevyplnil profil.</Text>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    backgroundColor: "#0b194f",
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  logoWrap: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
  },
  address: {
    marginTop: 4,
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
  },
  navigateButton: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingVertical: 10,
  },
  navigateButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 48,
    flexGrow: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#0b194f",
  },
  bodyText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#334155",
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  tag: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: {
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
  logoFallback: {
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
  },
  centeredState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    color: "#94a3b8",
    paddingHorizontal: 24,
  },
});
