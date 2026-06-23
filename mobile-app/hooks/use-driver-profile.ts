import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_DRIVER_PROFILE,
  normalizeDriverProfile,
  type DriverProfile,
} from "@/lib/driver-profile";
import { loadDriverProfile, saveDriverProfile } from "@/lib/driver-profile-storage";

export function useDriverProfile(enabled = true) {
  const [profile, setProfile] = useState<DriverProfile>(DEFAULT_DRIVER_PROFILE);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isSaving, setIsSaving] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) {
      return DEFAULT_DRIVER_PROFILE;
    }

    setIsLoading(true);
    try {
      const stored = await loadDriverProfile();
      setProfile(stored);
      return stored;
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void reload();
  }, [enabled, reload]);

  const updateProfile = useCallback(async (updates: Partial<DriverProfile>) => {
    setIsSaving(true);
    try {
      const next = normalizeDriverProfile({ ...profile, ...updates });
      const saved = await saveDriverProfile(next);
      setProfile(saved);
      return saved;
    } finally {
      setIsSaving(false);
    }
  }, [profile]);

  return {
    profile,
    isLoading,
    isSaving,
    reload,
    updateProfile,
  };
}
