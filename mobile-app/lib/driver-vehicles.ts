export type DriverVehicle = {
  id: string;
  label: string;
  plate: string;
  year: number;
  engine: string;
  power: string;
  fuelType: string;
  mileageKm: number;
  engineVolume: string;
  transmission: string;
  vin: string;
  color?: string;
};

export const DRIVER_VEHICLES: DriverVehicle[] = [
  {
    id: "1",
    label: "BMW X3 xDrive20d",
    plate: "ZA334OT",
    year: 2016,
    engine: "2.0 d",
    power: "140 kW",
    fuelType: "Diesel",
    mileageKm: 142_600,
    engineVolume: "2.0 l",
    transmission: "Automatická",
    vin: "WBAWZ5C50DD123456",
  },
  {
    id: "2",
    label: "Volkswagen Passat",
    plate: "ZA901PN",
    year: 2019,
    engine: "2.0 TDI",
    power: "110 kW",
    fuelType: "Diesel",
    mileageKm: 98_500,
    engineVolume: "2.0 l",
    transmission: "Automatická",
    vin: "WVWZZZ3CZJE123456",
  },
  {
    id: "3",
    label: "Škoda Octavia",
    plate: "BL118OD",
    year: 2020,
    engine: "2.0 TSI",
    power: "140 kW",
    fuelType: "Benzín",
    mileageKm: 78_500,
    engineVolume: "2.0 l",
    transmission: "Manuálna",
    vin: "TMBJJ7NE5L0123456",
  },
];

export function formatVehicleMileage(km: number) {
  return `${km.toLocaleString("sk-SK")} km`;
}

export function formatVehicleSpecsSummary(vehicle: DriverVehicle) {
  return [
    vehicle.engine,
    vehicle.power,
    formatVehicleMileage(vehicle.mileageKm),
    `r.v. ${vehicle.year}`,
  ].join(" · ");
}
