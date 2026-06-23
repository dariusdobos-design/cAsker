import type { ReactNode } from "react";
import { forwardRef } from "react";
import { type ImageSourcePropType } from "react-native";
import { Marker, type MapMarkerProps, type MarkerPressEvent } from "react-native-maps";

const SERVICE_MAP_PIN = require("@/assets/icons/service-map-pin.png") as ImageSourcePropType;

type ServiceMapMarkerProps = {
  coordinate: NonNullable<MapMarkerProps["coordinate"]>;
  companyName: string;
  addressLabel: string;
  callout?: ReactNode;
  onPress?: (event: MarkerPressEvent) => void;
  highlighted?: boolean;
  selected?: boolean;
  nativeCallout?: boolean;
};

export const ServiceMapMarker = forwardRef<Marker, ServiceMapMarkerProps>(function ServiceMapMarker(
  {
    coordinate,
    companyName,
    addressLabel,
    callout,
    onPress,
    highlighted = false,
    selected = false,
    nativeCallout = true,
  },
  ref,
) {
  return (
    <Marker
      ref={ref}
      coordinate={coordinate}
      title={nativeCallout ? companyName : undefined}
      description={nativeCallout ? addressLabel : undefined}
      anchor={{ x: 0.5, y: 1 }}
      zIndex={selected ? 999 : highlighted ? 12 : 2}
      image={SERVICE_MAP_PIN}
      moveOnMarkerPress={false}
      onPress={onPress}
    >
      {callout}
    </Marker>
  );
});
