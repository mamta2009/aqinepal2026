import { Pressable, ScrollView, Text, View } from "react-native";
import { BrandColors } from "@/constants/brand";
import { CITY_NAMES, type CityName } from "@/constants/cities";

interface CityPickerProps {
  selectedCity: CityName;
  onSelectCity: (city: CityName) => void;
}

export function CityPicker({ selectedCity, onSelectCity }: CityPickerProps) {
  return (
    <View className="py-4">
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
              accessibilityLabel={`Select ${city}`}
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelectCity(city)}
              className={
                isSelected
                  ? "min-h-11 justify-center rounded-full px-4 py-2"
                  : "min-h-11 justify-center rounded-full border border-border bg-white px-4 py-2"
              }
              style={
                isSelected ? { backgroundColor: BrandColors.forest } : undefined
              }>
              <Text
                className={
                  isSelected
                    ? "font-extrabold text-white"
                    : "font-semibold text-ink"
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
