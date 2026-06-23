import { formatDriveLabel, formatVehicleCategoryLabel, type VehicleCategory } from "@/lib/requests";

type VehicleDetailSpecsProps = {
  vehicleCategory: VehicleCategory;
  year: number;
  engine: string;
  engineVolume?: string;
  vehicleName?: string;
  power: string;
  fuelType: string;
  vin: string;
  mileageKm: number;
  transmission: string;
  drive: string;
  bodyType: string;
  doors: number;
};

function formatMileage(km: number) {
  return `${km.toLocaleString("sk-SK")} km`;
}

function formatFuelLabel(fuelType: string) {
  if (fuelType === "Nafta") return "Diesel";
  return fuelType;
}

/* Staršie dopyty z apky majú v poli "engine" omylom uložený názov
   vozidla — v takom prípade zobrazíme radšej objem motora. */
function resolveEngineValue(engine: string, engineVolume?: string, vehicleName?: string) {
  const trimmedEngine = engine?.trim() ?? "";
  const isVehicleName =
    !!vehicleName && trimmedEngine.toLowerCase() === vehicleName.trim().toLowerCase();

  if (trimmedEngine && !isVehicleName) {
    return trimmedEngine;
  }

  return engineVolume?.trim() || trimmedEngine || "—";
}

/* Jednotka je už v labeli "Výkon (kW)" — z hodnoty ju odstránime. */
function formatPowerValue(power: string) {
  return power?.replace(/\s*kw\s*$/i, "").trim() || "—";
}

export function VehicleDetailSpecs({
  vehicleCategory,
  year,
  engine,
  engineVolume,
  vehicleName,
  power,
  fuelType,
  vin,
  mileageKm,
  transmission,
  drive,
  bodyType,
  doors,
}: VehicleDetailSpecsProps) {
  const items = [
    { label: "Typ", value: formatVehicleCategoryLabel(vehicleCategory) },
    { label: "Rok výroby", value: String(year) },
    { label: "Motor", value: resolveEngineValue(engine, engineVolume, vehicleName) },
    { label: "Výkon (kW)", value: formatPowerValue(power) },
    { label: "Palivo", value: formatFuelLabel(fuelType) },
    { label: "VIN", value: vin },
    { label: "KM", value: formatMileage(mileageKm) },
    { label: "Prevodovka", value: transmission },
    { label: "Pohon", value: formatDriveLabel(drive) },
    { label: "Karoséria", value: bodyType },
    { label: "Dvere", value: String(doors) },
  ];

  return (
    <div className="casker-vehicle-specs-group">
      <ul className="casker-vehicle-spec-list">
        {items.map((item) => (
          <li key={item.label} className="casker-vehicle-spec-item">
            <span className="casker-vehicle-spec-label">{item.label}</span>
            <span className="casker-vehicle-spec-value">{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
