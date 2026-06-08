import type { ReactNode } from "react";
import { forwardRef } from "react";
import { type ImageSourcePropType } from "react-native";
import { Marker, type MapMarkerProps } from "react-native-maps";

const SERVICE_MAP_PIN = require("@/assets/icons/service-map-pin.png") as ImageSourcePropType;

type ServiceMapMarkerProps = {
  coordinate: NonNullable<MapMarkerProps["coordinate"]>;
  companyName: string;
  addressLabel: string;
  callout: ReactNode;
  highlighted?: boolean;
};

export const ServiceMapMarker = forwardRef<Marker, ServiceMapMarkerProps>(function ServiceMapMarker(
  { coordinate, companyName, addressLabel, callout, highlighted = false },
  ref,
) {
  return (
    <Marker
      ref={ref}
      coordinate={coordinate}
      title={companyName}
      description={addressLabel}
      anchor={{ x: 0.5, y: 1 }}
      zIndex={highlighted ? 12 : 2}
      image={SERVICE_MAP_PIN}
    >
      {callout}
    </Marker>
  );
});
