import { palette, type ThemeMode } from "./theme";

export type GoogleMapStyleElement = {
  featureType?: string;
  elementType?: string;
  stylers: Record<string, string | number>[];
};

export function googleMapStyle(mode: ThemeMode): GoogleMapStyleElement[] {
  const t = palette[mode];
  const mutedIcon: Record<string, string | number>[] =
    mode === "light" ? [{ saturation: -100 }, { lightness: 25 }] : [{ saturation: -100 }, { lightness: -20 }];
  return [
    { elementType: "geometry", stylers: [{ color: t.mapGround }] },
    { elementType: "labels.text.fill", stylers: [{ color: t.mapLabel }] },
    { elementType: "labels.text.stroke", stylers: [{ color: t.mapGround }] },
    { elementType: "labels.icon", stylers: mutedIcon },
    { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
    { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
    { featureType: "administrative.neighborhood", elementType: "labels", stylers: [{ visibility: "off" }] },
    { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: t.mapGround }] },
    { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: t.mapBlock }] },
    { featureType: "landscape.man_made", elementType: "labels", stylers: [{ visibility: "off" }] },
    { featureType: "poi", elementType: "geometry", stylers: [{ color: t.mapLandmark }] },
    { featureType: "poi", elementType: "labels.text", stylers: [{ color: t.mapLabel }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: t.mapPark }] },
    { featureType: "poi.government", stylers: [{ visibility: "off" }] },
    { featureType: "poi.place_of_worship", stylers: [{ visibility: "off" }] },
    { featureType: "poi.cemetery", stylers: [{ visibility: "off" }] },
    { featureType: "transit", elementType: "geometry", stylers: [{ visibility: "off" }] },
    { featureType: "transit.line", stylers: [{ visibility: "off" }] },
    { featureType: "transit.station", elementType: "labels.icon", stylers: mutedIcon },
    { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: t.mapLabel }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: t.mapRoad }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: t.mapBlock }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: t.mapLabel }] },
    { featureType: "road", elementType: "labels.text.stroke", stylers: [{ color: t.mapGround }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: t.mapRoad }] },
    { featureType: "road.highway", elementType: "labels", stylers: [{ visibility: "off" }] },
    { featureType: "road.highway", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: t.mapWater }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: t.mapLabel }] },
  ];
}
