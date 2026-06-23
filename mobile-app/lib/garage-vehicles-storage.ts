import AsyncStorage from "@react-native-async-storage/async-storage";

import type { DriverVehicle } from "@/lib/driver-vehicles";

const STORAGE_KEY = "casker.garage-vehicles";

/* Staršie uložené vozidlá majú v poli "engine" omylom názov vozidla —
   v takom prípade ho nahradíme objemom motora. */
function normalizeEngine(vehicle: DriverVehicle) {
  const engine = vehicle.engine?.trim() ?? "";
  const label = vehicle.label?.trim() ?? "";

  if (engine && label && engine.toLowerCase() === label.toLowerCase()) {
    return vehicle.engineVolume?.trim() || "";
  }

  return engine;
}

function normalizeVehicle(vehicle: DriverVehicle): DriverVehicle {
  return {
    ...vehicle,
    id: vehicle.id.trim(),
    label: vehicle.label.trim(),
    plate: vehicle.plate.trim().toUpperCase().replace(/\s+/g, ""),
    engine: normalizeEngine(vehicle),
    power: vehicle.power?.trim() ?? "",
    fuelType: vehicle.fuelType?.trim() ?? "",
    engineVolume: vehicle.engineVolume?.trim() ?? "",
    transmission: vehicle.transmission?.trim() ?? "",
    vin: vehicle.vin?.trim() ?? "",
    color: vehicle.color?.trim() ?? "",
    mileageKm: Number.isFinite(vehicle.mileageKm) ? Math.max(0, vehicle.mileageKm) : 0,
    year: Number.isFinite(vehicle.year) ? vehicle.year : new Date().getFullYear(),
  };
}

export async function loadGarageVehicles(): Promise<DriverVehicle[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as DriverVehicle[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((vehicle) => normalizeVehicle(vehicle));
  } catch {
    return [];
  }
}

export async function saveGarageVehicles(vehicles: DriverVehicle[]) {
  const normalized = vehicles.map((vehicle) => normalizeVehicle(vehicle));
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export async function addGarageVehicle(vehicle: DriverVehicle) {
  const vehicles = await loadGarageVehicles();
  const next = [...vehicles.filter((item) => item.id !== vehicle.id), normalizeVehicle(vehicle)];
  return saveGarageVehicles(next);
}

export async function removeGarageVehicle(vehicleId: string) {
  const vehicles = await loadGarageVehicles();
  return saveGarageVehicles(vehicles.filter((vehicle) => vehicle.id !== vehicleId));
}
