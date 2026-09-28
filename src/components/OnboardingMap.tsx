import type { ReactNode } from "react";
import { Platform, type StyleProp, type ViewStyle } from "react-native";
import MapView, { type Region } from "react-native-maps";
import { USE_GOOGLE_ON_IOS } from "../config";
import { googleMapStyle } from "../mapStyle";
import { useThemeMode } from "../theme";

type OnboardingMapProps = {
  initialRegion: Region;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export function OnboardingMap({ initialRegion, style, children }: OnboardingMapProps) {
  const mode = useThemeMode();
  const appleMaps = Platform.OS === "ios" && !USE_GOOGLE_ON_IOS;
  return (
    <MapView
      style={style}
      initialRegion={initialRegion}
      mapType={appleMaps ? "mutedStandard" : "standard"}
      customMapStyle={appleMaps ? undefined : googleMapStyle(mode)}
      showsPointsOfInterests={appleMaps}
      scrollEnabled={false}
      zoomEnabled={false}
      pitchEnabled={false}
      rotateEnabled={false}
      toolbarEnabled={false}
      showsCompass={false}
      showsUserLocation={false}
      pointerEvents="none"
    >
      {children}
    </MapView>
  );
}
