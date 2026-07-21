import { useRouter } from 'expo-router';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_BASE_URL } from '@/constants/api';
import { exportDashboardCsv } from '@/utils/exportDashboardCsv';

const SIDEBAR_WIDTH = 280;
const AQI_HELP_PATH = '/help/aqi-help';

interface DashboardActionsSidebarProps {
  open: boolean;
  onClose: () => void;
  onRefresh: () => void | Promise<void>;
  refreshing: boolean;
  selectedCity: string;
}

interface ActionRowProps {
  label: string;
  hint?: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'secondary' | 'primary';
  trailing?: ReactNode;
}

function ActionRow({
  label,
  hint,
  onPress,
  disabled,
  variant = 'secondary',
  trailing,
}: ActionRowProps) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={
        isPrimary
          ? 'flex-row items-center justify-between rounded-xl bg-primary px-4 py-3.5 active:opacity-80'
          : 'flex-row items-center justify-between rounded-xl border border-neutral-300 bg-white px-4 py-3.5 active:opacity-80 dark:border-neutral-700 dark:bg-neutral-900'
      }>
      <View className="flex-1 pr-2">
        <Text
          className={
            isPrimary
              ? 'text-sm font-semibold uppercase tracking-wide text-white'
              : 'text-sm font-semibold uppercase tracking-wide text-neutral-800 dark:text-neutral-100'
          }>
          {label}
        </Text>
        {hint ? (
          <Text
            className={
              isPrimary
                ? 'mt-0.5 text-xs text-white/80'
                : 'mt-0.5 text-xs text-neutral-500 dark:text-neutral-400'
            }>
            {hint}
          </Text>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
}

/** Collapsible right sidebar with the web dashboard header actions. */
export function DashboardActionsSidebar({
  open,
  onClose,
  onRefresh,
  refreshing,
  selectedCity,
}: DashboardActionsSidebarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const slide = useRef(new Animated.Value(SIDEBAR_WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(open);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(slide, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(slide, {
        toValue: SIDEBAR_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [open, slide, fade]);

  const handleRegister = useCallback(() => {
    onClose();
    router.push('/register');
  }, [onClose, router]);

  const handleAqiHelp = useCallback(async () => {
    const href = `${API_BASE_URL}${AQI_HELP_PATH}`;
    onClose();
    await openBrowserAsync(href, {
      presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
    });
  }, [onClose]);

  const handleRefresh = useCallback(async () => {
    await onRefresh();
    onClose();
  }, [onRefresh, onClose]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      await exportDashboardCsv(selectedCity);
      onClose();
    } finally {
      setExporting(false);
    }
  }, [selectedCity, onClose]);

  if (!mounted) return null;

  const panelWidth = Math.min(SIDEBAR_WIDTH, windowWidth * 0.86);

  return (
    <View className="absolute inset-0 z-50" pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={{ flex: 1, opacity: fade }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close actions menu"
          onPress={onClose}
          className="absolute inset-0 bg-black/40"
        />
      </Animated.View>

      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 0,
          width: panelWidth,
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 16,
          transform: [
            {
              translateX: slide.interpolate({
                inputRange: [0, SIDEBAR_WIDTH],
                outputRange: [0, panelWidth],
              }),
            },
          ],
        }}
        className="border-l border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-surface-dark">
        <View className="mb-4 flex-row items-center justify-between px-4">
          <Text className="text-base font-bold text-neutral-900 dark:text-white">
            Dashboard actions
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            className="rounded-lg px-2 py-1 active:opacity-70">
            <Text className="text-lg text-neutral-500 dark:text-neutral-400">✕</Text>
          </Pressable>
        </View>

        <View className="gap-3 px-4">
          <ActionRow
            label="Register for Alerts"
            hint="Sign up for SMS and email alerts"
            onPress={handleRegister}
          />
          <ActionRow
            label="aqiHelp"
            hint="How the platform works"
            onPress={() => {
              void handleAqiHelp();
            }}
          />
          <ActionRow
            label="Refresh"
            hint="Reload air quality, heat, cases, and alerts"
            onPress={() => {
              void handleRefresh();
            }}
            disabled={refreshing}
            trailing={
              refreshing ? <ActivityIndicator size="small" color="#1565c0" /> : null
            }
          />
          <ActionRow
            label="Export"
            hint="Download a CSV snapshot"
            onPress={() => {
              void handleExport();
            }}
            disabled={exporting}
            variant="primary"
            trailing={
              exporting ? <ActivityIndicator size="small" color="#ffffff" /> : null
            }
          />
        </View>
      </Animated.View>
    </View>
  );
}

interface DashboardMenuButtonProps {
  onPress: () => void;
}

/** Header control that opens the dashboard actions sidebar. */
export function DashboardMenuButton({ onPress }: DashboardMenuButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open dashboard actions"
      onPress={onPress}
      className="rounded-xl border border-neutral-300 bg-white px-3 py-2 active:opacity-80 dark:border-neutral-700 dark:bg-neutral-900">
      <Text className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">☰</Text>
    </Pressable>
  );
}
