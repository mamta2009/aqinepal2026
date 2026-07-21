import { type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <View className="mb-5 border-b border-neutral-200 pb-4 dark:border-neutral-800">
      <Text className="mb-1 text-lg font-bold text-neutral-900 dark:text-white">{title}</Text>
      {description ? (
        <Text className="mb-3 text-sm leading-5 text-neutral-500 dark:text-neutral-400">
          {description}
        </Text>
      ) : (
        <View className="mb-3" />
      )}
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
  autoCapitalize = 'none',
  keyboardType = 'default',
  multiline,
  editable = true,
}: AuthTextFieldProps) {
  return (
    <View className="mb-3">
      <Text className="mb-1 text-sm font-medium text-neutral-800 dark:text-neutral-200">{label}</Text>
      <TextInput
        className="rounded-xl border border-neutral-300 bg-white px-3 py-3 text-base text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardType={keyboardType}
        multiline={multiline}
        editable={editable}
        style={multiline ? { minHeight: 96, textAlignVertical: 'top' } : undefined}
      />
      {help ? (
        <Text className="mt-1 text-xs leading-4 text-neutral-500 dark:text-neutral-400">{help}</Text>
      ) : null}
      {error ? <Text className="mt-1 text-xs text-primary">{error}</Text> : null}
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
      <Text className="mb-2 text-sm font-medium text-neutral-800 dark:text-neutral-200">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((opt) => {
          const isOn = selected.includes(opt.value);
          return (
            <Pressable
              key={opt.value}
              onPress={() => toggle(opt.value)}
              className={
                isOn
                  ? 'rounded-full bg-primary px-3 py-2'
                  : 'rounded-full border border-neutral-300 px-3 py-2 dark:border-neutral-700'
              }>
              <Text
                className={
                  isOn ? 'text-sm font-semibold text-white' : 'text-sm text-neutral-700 dark:text-neutral-300'
                }>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {help ? (
        <Text className="mt-1 text-xs leading-4 text-neutral-500 dark:text-neutral-400">{help}</Text>
      ) : null}
      {error ? <Text className="mt-1 text-xs text-primary">{error}</Text> : null}
    </View>
  );
}

interface ConsentToggleProps {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  error?: string;
}

export function ConsentToggle({ label, checked, onChange, error }: ConsentToggleProps) {
  return (
    <View className="mb-3">
      <Pressable
        onPress={() => onChange(!checked)}
        className="flex-row items-center gap-3 rounded-xl border border-neutral-300 px-3 py-3 dark:border-neutral-700">
        <View
          className={
            checked
              ? 'h-5 w-5 items-center justify-center rounded bg-primary'
              : 'h-5 w-5 rounded border border-neutral-400'
          }>
          {checked ? <Text className="text-xs font-bold text-white">✓</Text> : null}
        </View>
        <Text className="flex-1 text-sm text-neutral-800 dark:text-neutral-200">{label}</Text>
      </Pressable>
      {error ? <Text className="mt-1 text-xs text-primary">{error}</Text> : null}
    </View>
  );
}

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  variant = 'primary',
}: PrimaryButtonProps) {
  const className =
    variant === 'primary'
      ? 'rounded-xl bg-primary px-4 py-3'
      : variant === 'secondary'
        ? 'rounded-xl border border-secondary bg-transparent px-4 py-3'
        : 'rounded-xl px-4 py-3';
  const textClass =
    variant === 'primary'
      ? 'text-center font-semibold text-white'
      : variant === 'secondary'
        ? 'text-center font-semibold text-secondary'
        : 'text-center font-semibold text-neutral-700 dark:text-neutral-300';

  return (
    <Pressable
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
      ? 'border-primary bg-red-50 dark:bg-red-950'
      : tone === 'success'
        ? 'border-success bg-green-50 dark:bg-green-950'
        : 'border-secondary bg-blue-50 dark:bg-blue-950';
  return (
    <View className={`mb-3 rounded-xl border px-3 py-2 ${toneClass}`}>
      <Text className="text-sm text-neutral-800 dark:text-neutral-200">{message}</Text>
    </View>
  );
}
