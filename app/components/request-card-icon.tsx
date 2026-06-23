import {
  isElectricVehicle,
  normalizeRequestCategory,
  type Request,
  type RequestCategory,
  type VehicleCategory,
} from "@/lib/requests";

const VEHICLE_ICON_SRC: Record<VehicleCategory, string> = {
  car: "/icons.svg/car.svg",
  van: "/icons.svg/van.svg",
};

const ELECTRIC_CAR_ICON_SRC = "/icons.svg/electric-car1.svg";

const REQUEST_CATEGORY_ICON_SRC: Partial<Record<RequestCategory, string>> = {
  tire: "/icons/wheel.svg",
  towing: "/icons/towing2.svg",
};

type RequestCardIconProps = {
  category: VehicleCategory;
  requestCategory?: RequestCategory;
  request?: Pick<Request, "fuelType" | "requestCategory">;
  isElectric?: boolean;
};

export function RequestCardIcon({
  category,
  requestCategory,
  request,
  isElectric,
}: RequestCardIconProps) {
  const resolvedCategory = normalizeRequestCategory(
    requestCategory ?? request?.requestCategory,
  );

  if (resolvedCategory === "tire" || resolvedCategory === "towing") {
    const src = REQUEST_CATEGORY_ICON_SRC[resolvedCategory];
    if (src) {
      return (
        <img
          src={src}
          alt=""
          className="casker-card-icon-image"
          width={26}
          height={26}
          aria-hidden
        />
      );
    }
  }

  const electric = isElectric ?? (request ? isElectricVehicle(request) : false);
  const src = electric ? ELECTRIC_CAR_ICON_SRC : VEHICLE_ICON_SRC[category];

  return (
    <img
      src={src}
      alt=""
      className="casker-card-icon-image"
      width={26}
      height={26}
      aria-hidden
    />
  );
}
