/**
 * Legacy animated Expo splash helpers kept for web demo bits.
 * App startup branding lives in `branded-startup-gate.tsx`.
 */
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { BrandColors } from "@/constants/brand";

export function AnimatedSplashOverlay() {
  return null;
}

export function AnimatedIcon() {
  return (
    <View style={styles.iconContainer}>
      <Image
        style={styles.image}
        source={require("@/assets/images/climate-compass-logo-192.png")}
        contentFit="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    justifyContent: "center",
    alignItems: "center",
    width: 128,
    height: 128,
    backgroundColor: BrandColors.skySoft,
    borderRadius: 32,
  },
  image: {
    width: 96,
    height: 96,
  },
});
