import type { VehicleCategory } from "@/lib/requests";

const VEHICLE_ICON_SRC: Record<VehicleCategory, string> = {
  car: "/icons.svg/car.svg",
  van: "/icons.svg/van.svg",
};

type RequestCardIconProps = {
  category: VehicleCategory;
};

export function RequestCardIcon({ category }: RequestCardIconProps) {
  return (
    <img
      src={VEHICLE_ICON_SRC[category]}
      alt=""
      className="casker-card-icon-image"
      width={26}
      height={26}
      aria-hidden
    />
  );
}
