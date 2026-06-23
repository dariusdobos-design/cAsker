import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  DEFAULT_DRIVER_PROFILE,
  normalizeDriverProfile,
  type DriverProfile,
} from "@/lib/driver-profile";

const STORAGE_KEY = "casker.driver-profile";

export async function hasPersistedDriverProfile() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw !== null;
}

export async function loadDriverProfile(): Promise<DriverProfile> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return DEFAULT_DRIVER_PROFILE;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DriverProfile>;
    return normalizeDriverProfile(parsed);
  } catch {
    return DEFAULT_DRIVER_PROFILE;
  }
}

export async function saveDriverProfile(profile: DriverProfile): Promise<DriverProfile> {
  const normalized = normalizeDriverProfile(profile);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export async function clearDriverProfile() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
