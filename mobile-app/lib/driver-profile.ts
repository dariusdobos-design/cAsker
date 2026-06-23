export type DriverProfile = {
  userName: string;
  phone: string;
  phoneDisplay: string;
  email: string;
};

export const DEFAULT_DRIVER_PROFILE: DriverProfile = {
  userName: "Dario Dobos",
  phone: "+421944294400",
  phoneDisplay: "+421944294400",
  email: "darius.dobos@gmail.com",
};

export function normalizeDriverProfile(value: Partial<DriverProfile> | null | undefined): DriverProfile {
  const userName = value?.userName?.trim() || DEFAULT_DRIVER_PROFILE.userName;
  const phoneInput = value?.phone?.trim() || value?.phoneDisplay?.trim() || DEFAULT_DRIVER_PROFILE.phone;
  const phone = formatPhoneForApi(phoneInput);
  const phoneDisplay = formatPhoneForDisplay(phoneInput);
  const email = value?.email?.trim() || DEFAULT_DRIVER_PROFILE.email;

  return {
    userName,
    phone,
    phoneDisplay,
    email,
  };
}

export function formatPhoneForDisplay(phone: string): string {
  const normalized = formatPhoneForApi(phone);
  if (normalized.startsWith("+421") && normalized.length === 13) {
    return `+421 ${normalized.slice(4, 7)} ${normalized.slice(7, 10)} ${normalized.slice(10)}`;
  }

  return phone.trim().replace(/\s+/g, " ");
}

export function formatPhoneForApi(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) {
    return DEFAULT_DRIVER_PROFILE.phone;
  }

  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("421")) {
    return `+${digits}`;
  }

  if (digits.startsWith("0")) {
    return `+421${digits.slice(1)}`;
  }

  return `+${digits}`;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** @deprecated Použi useDriverProfile alebo loadDriverProfile. */
export const DRIVER_PROFILE = DEFAULT_DRIVER_PROFILE;
