import { formatDriveLabel, formatVehicleCategoryLabel, type VehicleCategory } from "@/lib/requests";

type VehicleDetailSpecsProps = {
  vehicleCategory: VehicleCategory;
  year: number;
  engine: string;
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

export function VehicleDetailSpecs({
  vehicleCategory,
  year,
  engine,
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
    { label: "Motor", value: engine },
    { label: "Výkon", value: power },
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
