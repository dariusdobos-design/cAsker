import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "casker:driver-history-notification-seen-ids";

export async function loadSeenHistoryNotificationIds() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return new Set<string>();
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return new Set<string>();
    }

    return new Set(
      parsed.filter((id): id is string => typeof id === "string" && id.trim().length > 0),
    );
  } catch {
    return new Set<string>();
  }
}

export async function markHistoryNotificationSeen(requestId: string) {
  const trimmed = requestId.trim();
  if (!trimmed) {
    return;
  }

  const current = await loadSeenHistoryNotificationIds();
  if (current.has(trimmed)) {
    return;
  }

  current.add(trimmed);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...current]));
}

export async function markHistoryNotificationsSeen(requestIds: string[]) {
  const current = await loadSeenHistoryNotificationIds();
  let changed = false;

  for (const requestId of requestIds) {
    const trimmed = requestId.trim();
    if (!trimmed || current.has(trimmed)) {
      continue;
    }
    current.add(trimmed);
    changed = true;
  }

  if (!changed) {
    return;
  }

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...current]));
}
