import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { DEFAULT_CITY, isCityName, type CityName } from "@/constants/cities";

interface DashboardState {
  /** Mirrors `localStorage.currentCity` on the web dashboard (`frontend/index.html`). */
  selectedCity: CityName;
  setSelectedCity: (city: CityName) => void;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      selectedCity: DEFAULT_CITY,
      setSelectedCity: (city) => set({ selectedCity: city }),
    }),
    {
      name: "ew-dashboard-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ selectedCity: state.selectedCity }),
      merge: (persisted, current) => {
        const merged = {
          ...current,
          ...(persisted as Partial<DashboardState>),
        };
        return {
          ...merged,
          selectedCity: isCityName(merged.selectedCity)
            ? merged.selectedCity
            : DEFAULT_CITY,
        };
      },
    },
  ),
);
