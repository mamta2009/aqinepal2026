import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, DefaultTheme, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";
import { BrandedStartupGate } from "@/components/branded-startup-gate";
import { BrandColors } from "@/constants/brand";
import { FloatingAqiHelpButton } from "@/features/aqi-help";
import { AppDrawer } from "@/features/navigation/AppDrawer";
import { setUnauthorizedHandler } from "@/services/api/client";
import { queryClient } from "@/services/api/queryClient";
import { useAuthStore } from "@/store/authStore";

SplashScreen.preventAutoHideAsync();

const LightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: BrandColors.forest,
    background: BrandColors.surface,
    card: "#ffffff",
    text: BrandColors.ink,
    border: BrandColors.border,
    notification: BrandColors.alertRed,
  },
};

function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);
  const clearSession = useAuthStore((s) => s.clearSession);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void clearSession();
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={LightTheme}>
          <AuthBootstrap>
            <StatusBar style="dark" />
            <BrandedStartupGate>
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: BrandColors.surface },
                  headerTintColor: BrandColors.forest,
                  headerTitleStyle: { fontWeight: "700", color: BrandColors.ink },
                  contentStyle: { backgroundColor: BrandColors.surface },
                }}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="register" options={{ title: "Register" }} />
                <Stack.Screen name="verify" options={{ title: "Verify" }} />
                <Stack.Screen name="alerts" options={{ title: "Recent Alerts" }} />
                <Stack.Screen name="compare" options={{ title: "Compare cities" }} />
                <Stack.Screen name="map" options={{ title: "Map" }} />
                <Stack.Screen name="guides" options={{ title: "Guides" }} />
                <Stack.Screen name="about" options={{ title: "About" }} />
                <Stack.Screen name="aqi-help" options={{ title: "aqiHelp" }} />

                <Stack.Screen name="inbox" options={{ title: "Notification inbox" }} />
                <Stack.Screen
                  name="facility-actions"
                  options={{ title: "Facilities" }}
                />
                <Stack.Screen
                  name="friends"
                  options={{ title: "Trusted contacts" }}
                />
                <Stack.Screen
                  name="learn/[audience]"
                  options={{ title: "Learn" }}
                />
                <Stack.Screen
                  name="learn/guide/[path]"
                  options={{ title: "Guide" }}
                />
              </Stack>
              <FloatingAqiHelpButton />
              <AppDrawer />
            </BrandedStartupGate>
            <Toast />
          </AuthBootstrap>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
