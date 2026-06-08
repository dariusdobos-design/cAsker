import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  fetchDriverRequestMessages,
  markDriverRequestMessagesRead,
  sendDriverRequestMessage,
  type DriverRequestMessage,
} from "@/lib/driver-requests-api";

const POLL_INTERVAL_MS = 2500;

type RequestChatSheetProps = {
  visible: boolean;
  requestId: string;
  serviceName: string;
  customerName?: string;
  inquiryDescription?: string;
  onClose: () => void;
  onMessagesRead?: () => void;
};

type ChatTimelineItem =
  | { type: "date"; id: string; label: string }
  | { type: "message"; id: string; message: DriverRequestMessage };

const messageCache = new Map<string, DriverRequestMessage[]>();

function getDayKey(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatChatDate(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  if (getDayKey(iso) === getDayKey(today.toISOString())) {
    return "Dnes";
  }

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (getDayKey(iso) === getDayKey(yesterday.toISOString())) {
    return "Včera";
  }

  return date.toLocaleDateString("sk-SK", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

function formatChatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("sk-SK", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildTimeline(messages: DriverRequestMessage[]): ChatTimelineItem[] {
  const items: ChatTimelineItem[] = [];
  let lastDayKey: string | null = null;

  for (const message of messages) {
    const dayKey = getDayKey(message.createdAt);
    if (dayKey !== lastDayKey) {
      items.push({
        type: "date",
        id: `date-${dayKey}`,
        label: formatChatDate(message.createdAt),
      });
      lastDayKey = dayKey;
    }
    items.push({ type: "message", id: message.id, message });
  }

  return items;
}

function messagesFingerprint(messages: DriverRequestMessage[]) {
  return messages
    .map((message) => `${message.id}:${message.body}:${message.readAt ?? ""}`)
    .join("|");
}

function withInquirySeed(
  messages: DriverRequestMessage[],
  requestId: string,
  inquiryDescription: string,
): DriverRequestMessage[] {
  const inquiry = inquiryDescription.trim();
  if (!inquiry) {
    return messages;
  }

  const hasInquiryAlready = messages.some(
    (message) => message.senderRole === "customer" && message.body.trim() === inquiry,
  );
  if (hasInquiryAlready) {
    return messages;
  }

  return [
    {
      id: "inquiry-seed",
      requestId,
      senderRole: "customer",
      body: inquiry,
      createdAt: new Date(0).toISOString(),
      readAt: null,
    },
    ...messages,
  ];
}

export function RequestChatSheet({
  visible,
  requestId,
  serviceName,
  customerName = "Vy",
  inquiryDescription = "",
  onClose,
  onMessagesRead,
}: RequestChatSheetProps) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<DriverRequestMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const onMessagesReadRef = useRef(onMessagesRead);
  const pollInFlightRef = useRef(false);
  const lastFingerprintRef = useRef("");

  onMessagesReadRef.current = onMessagesRead;

  const displayMessages = useMemo(
    () => withInquirySeed(messages, requestId, inquiryDescription),
    [inquiryDescription, messages, requestId],
  );

  const timeline = useMemo(() => buildTimeline(displayMessages), [displayMessages]);

  const applyMessages = useCallback((requestKey: string, loaded: DriverRequestMessage[]) => {
    const fingerprint = messagesFingerprint(loaded);
    if (fingerprint === lastFingerprintRef.current) {
      return;
    }

    lastFingerprintRef.current = fingerprint;
    messageCache.set(requestKey, loaded);
    setMessages(loaded);
  }, []);

  const reloadMessages = useCallback(
    async (requestKey: string) => {
      if (pollInFlightRef.current) {
        return;
      }

      pollInFlightRef.current = true;
      try {
        const loaded = await fetchDriverRequestMessages(requestKey);
        applyMessages(requestKey, loaded);
      } catch (error) {
        const cached = messageCache.get(requestKey);
        if (!cached || cached.length === 0) {
          const message = error instanceof Error ? error.message : "Správy sa nepodarilo načítať.";
          Alert.alert("Chyba", message);
        }
      } finally {
        pollInFlightRef.current = false;
      }
    },
    [applyMessages],
  );

  useEffect(() => {
    if (!visible) {
      return;
    }

    const cached = messageCache.get(requestId);
    if (cached) {
      lastFingerprintRef.current = messagesFingerprint(cached);
      setMessages(cached);
      setIsInitialLoading(false);
    } else {
      setIsInitialLoading(true);
    }

    let cancelled = false;

    void (async () => {
      await reloadMessages(requestId);
      if (cancelled) {
        return;
      }
      setIsInitialLoading(false);

      try {
        await markDriverRequestMessagesRead(requestId);
        onMessagesReadRef.current?.();
      } catch {
        // Badge sa obnoví pri ďalšom načítaní dopytov.
      }
    })();

    const intervalId = setInterval(() => {
      void reloadMessages(requestId);
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [visible, requestId, reloadMessages]);

  useEffect(() => {
    if (!visible || displayMessages.length === 0) {
      return;
    }

    const timerId = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
    }, 50);

    return () => clearTimeout(timerId);
  }, [displayMessages.length, visible]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || isSending) {
      return;
    }

    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage: DriverRequestMessage = {
      id: optimisticId,
      requestId,
      senderRole: "customer",
      body: text,
      createdAt: new Date().toISOString(),
      readAt: null,
    };

    setDraft("");
    setIsSending(true);
    setMessages((current) => {
      const next = [...current, optimisticMessage];
      lastFingerprintRef.current = messagesFingerprint(next);
      messageCache.set(requestId, next);
      return next;
    });

    try {
      const saved = await sendDriverRequestMessage(requestId, text);
      if (!saved) {
        throw new Error("Správu sa nepodarilo odoslať.");
      }

      setMessages((current) => {
        const next = current.map((message) => (message.id === optimisticId ? saved : message));
        lastFingerprintRef.current = messagesFingerprint(next);
        messageCache.set(requestId, next);
        return next;
      });
    } catch (error) {
      setMessages((current) => {
        const next = current.filter((message) => message.id !== optimisticId);
        lastFingerprintRef.current = messagesFingerprint(next);
        messageCache.set(requestId, next);
        return next;
      });
      setDraft(text);
      const message = error instanceof Error ? error.message : "Správu sa nepodarilo odoslať.";
      Alert.alert("Chyba", message);
    } finally {
      setIsSending(false);
    }
  };

  const showInitialSpinner = isInitialLoading && messages.length === 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 12) }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Zavrieť chat">
            <FontAwesome name="chevron-left" size={18} color="#0b194f" />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Chat</Text>
            <Text style={styles.subtitle}>{serviceName}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.messagesWrap}>
          {showInitialSpinner ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#0b194f" />
            </View>
          ) : null}

          <ScrollView
            ref={scrollRef}
            style={styles.messages}
            contentContainerStyle={styles.messagesContent}
            keyboardShouldPersistTaps="handled"
          >
            {timeline.map((item) => {
              if (item.type === "date") {
                return (
                  <View key={item.id} style={styles.dateDivider}>
                    <Text style={styles.dateDividerText}>{item.label}</Text>
                  </View>
                );
              }

              const message = item.message;
              const isOutgoing = message.senderRole === "customer";

              return (
                <View
                  key={item.id}
                  style={[
                    styles.messageColumn,
                    isOutgoing ? styles.messageColumnOutgoing : styles.messageColumnIncoming,
                  ]}
                >
                  <Text style={styles.messageMeta}>
                    {isOutgoing ? customerName : serviceName} · {formatChatTime(message.createdAt)}
                  </Text>
                  <View
                    style={[
                      styles.messageBubble,
                      isOutgoing ? styles.messageBubbleOutgoing : styles.messageBubbleIncoming,
                    ]}
                  >
                    <Text style={styles.messageText}>{message.body}</Text>
                  </View>
                  {isOutgoing && message.readAt ? (
                    <Text style={styles.messageRead}>Videné</Text>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.compose}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Vaša správa…"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            multiline
            maxLength={2000}
          />
          <Pressable
            onPress={() => {
              void handleSend();
            }}
            disabled={!draft.trim() || isSending}
            style={[styles.sendButton, (!draft.trim() || isSending) && styles.sendButtonDisabled]}
          >
            <Text style={styles.sendButtonText}>{isSending ? "…" : "Odoslať"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerText: {
    flex: 1,
    alignItems: "center",
  },
  headerSpacer: {
    width: 18,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0b194f",
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: "#64748b",
  },
  messagesWrap: {
    flex: 1,
    position: "relative",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.72)",
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  dateDivider: {
    alignItems: "center",
    marginVertical: 8,
  },
  dateDividerText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
  },
  messageColumn: {
    maxWidth: "88%",
  },
  messageColumnIncoming: {
    alignSelf: "flex-start",
  },
  messageColumnOutgoing: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  messageBubble: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  messageBubbleIncoming: {
    backgroundColor: "#f1f5f9",
  },
  messageBubbleOutgoing: {
    backgroundColor: "#e8eef8",
  },
  messageMeta: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#0f172a",
  },
  messageRead: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: "400",
    color: "#a1a1aa",
  },
  compose: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  sendButton: {
    borderRadius: 12,
    backgroundColor: "#0b194f",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  sendButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
});
