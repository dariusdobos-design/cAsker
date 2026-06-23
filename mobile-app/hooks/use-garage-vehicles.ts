import { useCallback, useEffect, useState } from "react";

import type { DriverVehicle } from "@/lib/driver-vehicles";
import {
  addGarageVehicle,
  loadGarageVehicles,
  removeGarageVehicle,
  saveGarageVehicles,
} from "@/lib/garage-vehicles-storage";

export function useGarageVehicles(enabled = true) {
  const [vehicles, setVehicles] = useState<DriverVehicle[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isSaving, setIsSaving] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) {
      return;
    }

    setIsLoading(true);
    try {
      const next = await loadGarageVehicles();
      setVehicles(next);
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const upsertVehicle = useCallback(async (vehicle: DriverVehicle) => {
    setIsSaving(true);
    try {
      const next = await addGarageVehicle(vehicle);
      setVehicles(next);
      return vehicle;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const deleteVehicle = useCallback(async (vehicleId: string) => {
    setIsSaving(true);
    try {
      const next = await removeGarageVehicle(vehicleId);
      setVehicles(next);
    } finally {
      setIsSaving(false);
    }
  }, []);

  const replaceAll = useCallback(async (nextVehicles: DriverVehicle[]) => {
    setIsSaving(true);
    try {
      const next = await saveGarageVehicles(nextVehicles);
      setVehicles(next);
    } finally {
      setIsSaving(false);
    }
  }, []);

  return {
    vehicles,
    isLoading,
    isSaving,
    reload,
    upsertVehicle,
    deleteVehicle,
    replaceAll,
  };
}
