import { Pressable, ScrollView, Text, View } from 'react-native';

import { CITY_NAMES, type CityName } from '@/constants/cities';

/** Matches `--phase1` on the web geographic selector. */
const PHASE1_GREEN = '#10b981';

interface CityPickerProps {
  selectedCity: CityName;
  onSelectCity: (city: CityName) => void;
}

/** Recreates the `<select id="citySelector">` on the web dashboard as a horizontal chip row. */
export function CityPicker({ selectedCity, onSelectCity }: CityPickerProps) {
  return (
    <View className="mb-4">
      <Text className="mb-2 px-4 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        City
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {CITY_NAMES.map((city) => {
          const isSelected = city === selectedCity;
          return (
            <Pressable
              key={city}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelectCity(city)}
              className={
                isSelected
                  ? 'rounded-full px-4 py-2'
                  : 'rounded-full border border-neutral-300 px-4 py-2 dark:border-neutral-700'
              }
              style={isSelected ? { backgroundColor: PHASE1_GREEN } : undefined}>
              <Text
                className={
                  isSelected
                    ? 'font-semibold text-white'
                    : 'text-neutral-700 dark:text-neutral-300'
                }>
                {city}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
