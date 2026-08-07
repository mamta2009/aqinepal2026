import { type ReactNode, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

export function FormSection({
  number,
  title,
  description,
  children,
}: {
  number?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <View className="mb-5 overflow-hidden rounded-2xl border border-border bg-white p-4">
      <View className="mb-3 flex-row items-center gap-2">
        {number ? (
          <View className="h-8 w-8 items-center justify-center rounded-full bg-forest">
            <Text className="text-sm font-extrabold text-white">{number}</Text>
          </View>
        ) : null}
        <Text className="flex-1 text-lg font-extrabold text-ink">{title}</Text>
      </View>
      {description ? (
        <Text className="mb-3 text-sm leading-5 text-muted">{description}</Text>
      ) : null}
      {children}
    </View>
  );
}

interface AuthTextFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  help?: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  /** Adds a show/hide control when the field is a password. */
  showSecureToggle?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  multiline?: boolean;
  editable?: boolean;
}

export function AuthTextField({
  label,
  value,
  onChangeText,
  error,
  help,
  placeholder,
  secureTextEntry,
  showSecureToggle,
  autoCapitalize = 'none',
  keyboardType = 'default',
  multiline,
  editable = true,
}: AuthTextFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const isSecure = Boolean(secureTextEntry) && !(showSecureToggle && revealed);

  return (
    <View className="mb-3">
      <Text className="mb-1 text-sm font-bold text-ink">{label}</Text>
      <View className="relative">
        <TextInput
          className="min-h-11 rounded-xl border border-border-strong bg-white px-3 py-3 text-base text-ink"
          style={[
            multiline ? { minHeight: 96, textAlignVertical: 'top' } : undefined,
            showSecureToggle ? { paddingRight: 52 } : undefined,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#526b78"
          secureTextEntry={isSecure}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          keyboardType={keyboardType}
          multiline={multiline}
          editable={editable}
        />
        {showSecureToggle && secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            onPress={() => setRevealed((v) => !v)}
            className="absolute bottom-0 right-0 top-0 min-w-11 items-center justify-center px-3">
            <Text className="text-xs font-extrabold text-muted">
              {revealed ? 'Hide' : 'Show'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {help ? (
        <Text className="mt-1 text-xs leading-4 text-muted">{help}</Text>
      ) : null}
      {error ? <Text className="mt-1 text-xs text-alert-red">{error}</Text> : null}
    </View>
  );
}

interface ChipOption {
  value: string;
  label: string;
}

interface ChipMultiSelectProps {
  label: string;
  options: ChipOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  error?: string;
  help?: string;
  /** When true, selecting a chip replaces the selection (single-select). */
  single?: boolean;
}

export function ChipMultiSelect({
  label,
  options,
  selected,
  onChange,
  error,
  help,
  single = false,
}: ChipMultiSelectProps) {
  const toggle = (value: string) => {
    if (single) {
      onChange([value]);
      return;
    }
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <View className="mb-3">
      <Text className="mb-2 text-sm font-bold text-ink">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((opt) => {
          const isOn = selected.includes(opt.value);
          return (
            <Pressable
              key={opt.value}
              onPress={() => toggle(opt.value)}
              className={
                isOn
                  ? 'rounded-xl border border-forest bg-surface-tint px-3 py-2.5'
                  : 'rounded-xl border border-border bg-white px-3 py-2.5'
              }>
              <Text
                className={
                  isOn
                    ? 'text-sm font-bold text-forest'
                    : 'text-sm font-bold text-ink'
                }>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {help ? (
        <Text className="mt-1 text-xs leading-4 text-muted">{help}</Text>
      ) : null}
      {error ? <Text className="mt-1 text-xs text-alert-red">{error}</Text> : null}
    </View>
  );
}

interface ConsentToggleProps {
  label: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  error?: string;
}

export function ConsentToggle({ label, checked, onChange, error }: ConsentToggleProps) {
  return (
    <View className="mb-3">
      <Pressable
        onPress={() => onChange(!checked)}
        className="flex-row items-start gap-3 rounded-xl border border-border bg-surface px-3 py-3">
        <View
          className={
            checked
              ? 'mt-0.5 h-5 w-5 items-center justify-center rounded bg-forest'
              : 'mt-0.5 h-5 w-5 rounded border border-border-strong'
          }>
          {checked ? <Text className="text-xs font-bold text-white">✓</Text> : null}
        </View>
        {typeof label === 'string' ? (
          <Text className="flex-1 text-sm leading-5 text-ink">{label}</Text>
        ) : (
          <View className="flex-1">{label}</View>
        )}
      </Pressable>
      {error ? <Text className="mt-1 text-xs text-alert-red">{error}</Text> : null}
    </View>
  );
}

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /**
   * Semantic button styles (consistent app-wide):
   * - action / primary — filled forest: main constructive CTAs
   * - secondary — forest outline on sky fill
   * - danger — filled red
   * - dangerOutline — red outline
   * - ghost — neutral bordered
   */
  variant?: 'action' | 'primary' | 'secondary' | 'danger' | 'dangerOutline' | 'ghost';
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  variant = 'action',
}: PrimaryButtonProps) {
  const resolved = variant === 'primary' ? 'action' : variant;

  const className =
    resolved === 'action'
      ? 'min-h-11 rounded-full bg-forest px-4 py-3 active:opacity-80'
      : resolved === 'secondary'
        ? 'min-h-11 rounded-full border-2 border-forest bg-sky-soft px-4 py-3 active:opacity-80'
        : resolved === 'danger'
          ? 'min-h-11 rounded-full bg-alert-red px-4 py-3 active:opacity-80'
          : resolved === 'dangerOutline'
            ? 'min-h-11 rounded-full border-2 border-alert-red bg-red-50 px-4 py-3 active:opacity-80'
            : 'min-h-11 rounded-full border border-border bg-white px-4 py-3 active:opacity-80';

  const textClass =
    resolved === 'action' || resolved === 'danger'
      ? 'text-center font-extrabold text-white'
      : resolved === 'secondary'
        ? 'text-center font-extrabold text-forest'
        : resolved === 'dangerOutline'
          ? 'text-center font-extrabold text-alert-red'
          : 'text-center font-extrabold text-ink';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      className={`${className} ${disabled ? 'opacity-50' : ''}`}>
      <Text className={textClass}>{label}</Text>
    </Pressable>
  );
}

export function Banner({
  message,
  tone = 'info',
}: {
  message: string;
  tone?: 'info' | 'error' | 'success';
}) {
  const toneClass =
    tone === 'error'
      ? 'border-alert-red bg-red-50'
      : tone === 'success'
        ? 'border-forest bg-surface-tint'
        : 'border-link bg-sky-soft';
  return (
    <View className={`mb-3 rounded-xl border px-3 py-2 ${toneClass}`}>
      <Text className="text-sm text-ink">{message}</Text>
    </View>
  );
}

/** Simple mode tab pair (password vs OTP). */
export function AuthModeTabs({
  mode,
  onChange,
}: {
  mode: 'password' | 'otp';
  onChange: (next: 'password' | 'otp') => void;
}) {
  return (
    <View
      accessibilityRole="tablist"
      className="mb-4 flex-row flex-wrap gap-2">
      {(
        [
          { id: 'password' as const, label: 'Email and password' },
          { id: 'otp' as const, label: 'Facility OTP' },
        ] as const
      ).map((tab) => {
        const selected = mode === tab.id;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.id)}
            className={
              selected
                ? 'min-h-11 items-center justify-center rounded-full bg-forest px-4 py-2.5'
                : 'min-h-11 items-center justify-center rounded-full border border-border bg-white px-4 py-2.5'
            }>
            <Text
              className={
                selected
                  ? 'text-sm font-extrabold text-white'
                  : 'text-sm font-extrabold text-ink'
              }>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
