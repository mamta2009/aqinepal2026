import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { setUnauthorizedHandler } from '@/services/api/client';
import { queryClient } from '@/services/api/queryClient';
import { useAuthStore } from '@/store/authStore';

SplashScreen.preventAutoHideAsync();

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
  const colorScheme = useColorScheme();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthBootstrap>
          <AnimatedSplashOverlay />
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="register" options={{ title: 'Register' }} />
            <Stack.Screen name="verify" options={{ title: 'Verify' }} />
            <Stack.Screen name="alerts" options={{ title: 'Recent Alerts' }} />
            <Stack.Screen name="compare" options={{ title: 'Compare cities' }} />
            <Stack.Screen name="inbox" options={{ title: 'Notifications' }} />
            <Stack.Screen name="facility-actions" options={{ title: 'Facility Actions' }} />
            <Stack.Screen name="friends" options={{ title: 'Friends & family' }} />
          </Stack>
        </AuthBootstrap>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
