import { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

export function SectionTitle({
  eyebrow,
  title,
  lede,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
}) {
  return (
    <View className="mb-4">
      {eyebrow ? (
        <Text className="mb-1 text-xs font-extrabold uppercase tracking-widest text-forest">
          {eyebrow}
        </Text>
      ) : null}
      <Text className="text-2xl font-extrabold leading-tight tracking-tight text-ink">
        {title}
      </Text>
      {lede ? (
        <Text className="mt-2 text-base leading-6 text-muted">{lede}</Text>
      ) : null}
    </View>
  );
}

export function SharedButton({
  label,
  onPress,
  variant = "primary",
  disabled,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const className =
    variant === "primary"
      ? "min-h-11 items-center justify-center rounded-full bg-forest px-5 py-3 active:opacity-85"
      : variant === "secondary"
        ? "min-h-11 items-center justify-center rounded-full border-2 border-forest bg-white px-5 py-3 active:opacity-85"
        : variant === "danger"
          ? "min-h-11 items-center justify-center rounded-full bg-alert-red px-5 py-3 active:opacity-85"
          : "min-h-11 items-center justify-center rounded-full border border-border bg-white px-5 py-3 active:opacity-85";
  const textClass =
    variant === "primary" || variant === "danger"
      ? "text-center text-base font-extrabold text-white"
      : variant === "secondary"
        ? "text-center text-base font-extrabold text-forest"
        : "text-center text-base font-extrabold text-ink";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      className={`${className} ${disabled ? "opacity-50" : ""}`}>
      <Text className={textClass}>{label}</Text>
    </Pressable>
  );
}

export function StatusCard({
  label,
  value,
  valueContent,
  detail,
  accentColor,
  help,
  children,
}: {
  label: string;
  value: string;
  /** When set, shown instead of the text value (e.g. rain status icons). */
  valueContent?: ReactNode;
  detail?: string | null;
  accentColor?: string;
  help?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <View className="min-h-[120px] flex-1 rounded-2xl border border-border bg-white p-4 shadow-sm">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-xs font-extrabold uppercase tracking-wide text-muted">
          {label}
        </Text>
        {help}
      </View>
      {valueContent ? (
        <View accessibilityLabel={value}>{valueContent}</View>
      ) : (
        <Text
          className="text-2xl font-extrabold text-ink"
          style={accentColor ? { color: accentColor } : undefined}>
          {value}
        </Text>
      )}
      {detail ? (
        <Text className="mt-1 text-sm leading-5 text-muted">{detail}</Text>
      ) : null}
      {children}
    </View>
  );
}

export function RecommendationCard({
  index,
  title,
  action,
}: {
  index: number;
  title: string;
  action: string;
}) {
  return (
    <View className="mb-3 flex-row gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-sky-soft">
        <Text className="font-extrabold text-link">{index}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-base font-extrabold text-ink">{title}</Text>
        <Text className="mt-1 text-sm leading-5 text-muted">{action}</Text>
      </View>
    </View>
  );
}

export function EducationalCard({
  audience,
  title,
  description,
  onPress,
}: {
  audience: string;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${audience}`}
      onPress={onPress}
      className="mb-3 rounded-2xl border border-border bg-white p-5 shadow-sm active:opacity-90">
      <Text className="mb-1 text-xs font-extrabold uppercase tracking-wide text-forest">
        {audience}
      </Text>
      <Text className="text-lg font-extrabold text-ink">{title}</Text>
      <Text className="mt-2 text-sm leading-5 text-muted">{description}</Text>
      <Text className="mt-3 font-extrabold text-link">Open →</Text>
    </Pressable>
  );
}

export function LoadingCard({ label = "Loading…" }: { label?: string }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      className="items-center justify-center rounded-2xl border border-border bg-white p-8">
      <Text className="text-sm text-muted">{label}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <View className="items-center rounded-2xl border border-border bg-surface-tint p-6">
      <Text className="text-center text-lg font-extrabold text-ink">{title}</Text>
      <Text className="mt-2 text-center text-sm leading-5 text-muted">{message}</Text>
    </View>
  );
}

export function AppHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View className="mb-3 flex-row items-start justify-between">
      <View className="mr-3 flex-1">
        <Text className="text-2xl font-extrabold tracking-tight text-forest">
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-sm text-muted">{subtitle}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}
