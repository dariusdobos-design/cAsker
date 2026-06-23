import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "casker.customer-request-ids";

export async function loadCustomerRequestIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

export async function saveCustomerRequestId(requestId: string) {
  const trimmed = requestId.trim();
  if (!trimmed) {
    return;
  }

  const current = await loadCustomerRequestIds();
  if (current.includes(trimmed)) {
    return;
  }

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([trimmed, ...current]));
}

export async function clearCustomerRequestIds() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/** Doplní uložené ID o dopyty z posledného načítania. Pri prázdnej odpovedi nič nemaže. */
export async function syncCustomerRequestIds(existingRequestIds: string[]) {
  const normalized = existingRequestIds
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  if (normalized.length === 0) {
    return;
  }

  const stored = await loadCustomerRequestIds();
  const merged = [...new Set([...normalized, ...stored])];

  if (merged.length === stored.length && normalized.every((id) => stored.includes(id))) {
    return;
  }

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
}
