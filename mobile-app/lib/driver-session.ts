import AsyncStorage from "@react-native-async-storage/async-storage";

import { clearDriverAuthCredentials } from "@/lib/driver-auth-credentials";
import { clearCustomerRequestIds } from "@/lib/customer-request-ids";
import { clearDriverProfile } from "@/lib/driver-profile-storage";

const STORAGE_KEY = "casker.driver-session";

type DriverSessionState = {
  loggedIn: boolean;
};

const DEFAULT_SESSION: DriverSessionState = {
  loggedIn: false,
};

export async function loadDriverSession(): Promise<DriverSessionState> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return DEFAULT_SESSION;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DriverSessionState>;
    return {
      loggedIn: parsed.loggedIn === true,
    };
  } catch {
    return DEFAULT_SESSION;
  }
}

export async function isDriverLoggedIn() {
  const session = await loadDriverSession();
  return session.loggedIn;
}

export async function loginDriverSession() {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ loggedIn: true } satisfies DriverSessionState));
}

/** Ukončí prihlásenie bez vymazania profilu alebo uložených dopytov. */
export async function logoutDriverSession() {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ loggedIn: false } satisfies DriverSessionState));
}

/** Zatiaľ len lokálne vymazanie účtu v telefóne + odhlásenie. */
export async function deleteDriverAccountLocally() {
  await Promise.all([
    clearDriverProfile(),
    clearDriverAuthCredentials(),
    clearCustomerRequestIds(),
  ]);
  await logoutDriverSession();
}
