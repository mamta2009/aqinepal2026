import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, { FadeOut } from "react-native-reanimated";

import { BrandColors } from "@/constants/brand";
import {
  getAirQualityCurrent,
  getHeatCurrent,
  getWeatherCurrent,
} from "@/services/api/dashboard";
import { getCities } from "@/services/api/cities";
import { getRuntimeConfig } from "@/services/api/runtimeConfig";
import { queryClient } from "@/services/api/queryClient";
import { useDashboardStore } from "@/store/dashboardStore";

const SAFETY_TIMEOUT_MS = 9000;

async function prefetchCoreData(city: string) {
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: ["runtime-config"],
      queryFn: getRuntimeConfig,
      staleTime: 60 * 60 * 1000,
    }),
    queryClient.prefetchQuery({
      queryKey: ["cities"],
      queryFn: getCities,
      staleTime: 60 * 60 * 1000,
    }),
    queryClient.prefetchQuery({
      queryKey: ["air-quality-current", city],
      queryFn: () => getAirQualityCurrent(city as never),
    }),
    queryClient.prefetchQuery({
      queryKey: ["heat-current", city],
      queryFn: () => getHeatCurrent(city as never),
    }),
    queryClient.prefetchQuery({
      queryKey: ["weather-current", city],
      queryFn: () => getWeatherCurrent(city as never),
    }),
  ]);
}

/**
 * Branded startup screen: keeps native splash covered, prefetches core
 * dashboard queries, then reveals the app with a short fade.
 */
export function BrandedStartupGate({ children }: { children: ReactNode }) {
  const selectedCity = useDashboardStore((s) => s.selectedCity);
  const [ready, setReady] = useState(false);
  const finished = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const markReady = () => {
      if (finished.current || cancelled) return;
      finished.current = true;
      SplashScreen.hideAsync().finally(() => {
        if (!cancelled) setReady(true);
      });
    };

    const timeout = setTimeout(markReady, SAFETY_TIMEOUT_MS);

    void (async () => {
      try {
        await prefetchCoreData(selectedCity);
      } finally {
        markReady();
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [selectedCity]);

  return (
    <View style={styles.root}>
      {children}
      {!ready ? (
        <Animated.View
          exiting={FadeOut.duration(420)}
          style={styles.overlay}
          pointerEvents="auto">
          <Image
            source={require("@/assets/images/climate-compass-logo-192.png")}
            style={styles.logo}
            contentFit="contain"
            accessibilityLabel="Climate Compass"
          />
          <Text style={styles.title}>Climate Compass</Text>
          <Text style={styles.subtitle}>
            {"Checking today's air, heat, and rain near you…"}
          </Text>
          <ActivityIndicator
            color={BrandColors.forest}
            style={styles.spinner}
            accessibilityLabel="Loading"
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BrandColors.surface,
    paddingHorizontal: 32,
  },
  logo: {
    width: 128,
    height: 128,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: BrandColors.forest,
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 22,
    color: BrandColors.muted,
    textAlign: "center",
  },
  spinner: {
    marginTop: 28,
  },
});
