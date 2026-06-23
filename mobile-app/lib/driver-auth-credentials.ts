import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  hasPersistedDriverProfile,
  loadDriverProfile,
} from "@/lib/driver-profile-storage";

const STORAGE_KEY = "casker.driver-auth";
const MIN_PASSWORD_LENGTH = 6;

type DriverAuthCredentials = {
  email: string;
  password: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function loadDriverAuthCredentials(): Promise<DriverAuthCredentials | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DriverAuthCredentials>;
    if (!parsed.email?.trim() || !parsed.password) {
      return null;
    }

    return {
      email: normalizeEmail(parsed.email),
      password: parsed.password,
    };
  } catch {
    return null;
  }
}

export async function saveDriverAuthCredentials(email: string, password: string) {
  const payload: DriverAuthCredentials = {
    email: normalizeEmail(email),
    password,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export async function updateDriverAuthEmail(email: string) {
  const credentials = await loadDriverAuthCredentials();
  if (!credentials) {
    return;
  }

  await saveDriverAuthCredentials(email, credentials.password);
}

export async function clearDriverAuthCredentials() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/** Účet existuje, ak sú uložené prihlasovacie údaje alebo starší profil v telefóne. */
export async function hasRegisteredAccount() {
  if (await loadDriverAuthCredentials()) {
    return true;
  }

  return hasPersistedDriverProfile();
}

export async function verifyDriverLogin(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  const trimmedPassword = password.trim();

  const credentials = await loadDriverAuthCredentials();
  if (credentials) {
    return (
      credentials.email === normalizedEmail &&
      credentials.password === trimmedPassword
    );
  }

  if (!(await hasPersistedDriverProfile())) {
    return false;
  }

  const profile = await loadDriverProfile();
  if (normalizeEmail(profile.email) !== normalizedEmail) {
    return false;
  }

  // Starý účet bez hesla – pri prvom prihlásení sa heslo uloží.
  if (trimmedPassword.length < MIN_PASSWORD_LENGTH) {
    return false;
  }

  await saveDriverAuthCredentials(normalizedEmail, trimmedPassword);
  return true;
}
