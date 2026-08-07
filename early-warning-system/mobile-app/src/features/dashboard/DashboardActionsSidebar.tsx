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
          ? 'min-h-11 flex-row items-center justify-between rounded-2xl bg-forest px-4 py-3.5 active:opacity-80'
          : 'min-h-11 flex-row items-center justify-between rounded-2xl border border-border bg-white px-4 py-3.5 active:opacity-80'
      }>
      <View className="flex-1 pr-2">
        <Text
          className={
            isPrimary
              ? 'text-sm font-extrabold uppercase tracking-wide text-white'
              : 'text-sm font-extrabold uppercase tracking-wide text-ink'
          }>
          {label}
        </Text>
        {hint ? (
          <Text
            className={
              isPrimary
                ? 'mt-0.5 text-xs text-white/80'
                : 'mt-0.5 text-xs text-muted'
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

  const handleAlerts = useCallback(() => {
    onClose();
    router.push({ pathname: '/alerts', params: { city: selectedCity } });
  }, [onClose, router, selectedCity]);

  const handleCompare = useCallback(() => {
    onClose();
    router.push('/compare');
  }, [onClose, router]);

  const handleLearn = useCallback(() => {
    onClose();
    router.push('/learn');
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
        className="border-l border-border bg-surface">
        <View className="mb-4 flex-row items-center justify-between px-4">
          <Text className="text-base font-extrabold text-ink">
            Home actions
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            className="min-h-11 min-w-11 items-center justify-center rounded-lg active:opacity-70">
            <Text className="text-2xl leading-none text-muted">✕</Text>
          </Pressable>
        </View>

        <View className="gap-3 px-4">
          <ActionRow
            label="Register for Alerts"
            hint="Sign up for SMS and email alerts"
            onPress={handleRegister}
          />
          <ActionRow
            label="Recent Alerts"
            hint={`View alerts for ${selectedCity}`}
            onPress={handleAlerts}
          />
          <ActionRow
            label="Compare Cities"
            hint="Side-by-side air snapshot chart and readings"
            onPress={handleCompare}
          />
          <ActionRow
            label="Learn"
            hint="Tips for students, families, and schools"
            onPress={handleLearn}
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
            hint="Reload air, heat, rain, cases, and alerts"
            onPress={() => {
              void handleRefresh();
            }}
            disabled={refreshing}
            trailing={
              refreshing ? <ActivityIndicator size="small" color="#1f794b" /> : null
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
      accessibilityLabel="Open home actions"
      onPress={onPress}
      className="min-h-11 min-w-11 items-center justify-center rounded-2xl border border-border bg-white px-3.5 py-2.5 active:opacity-80">
      <Text className="text-2xl font-semibold leading-none text-ink">☰</Text>
    </Pressable>
  );
}
