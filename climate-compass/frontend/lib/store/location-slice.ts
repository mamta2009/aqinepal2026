import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export const SELECTED_CITY_STORAGE_KEY = "climate-compass.selectedCity";
export const DEFAULT_SELECTED_CITY = "Kathmandu";

export type LocationState = {
  selectedCity: string;
  /** True after client has attempted to read localStorage (avoids SSR mismatch). */
  hydrated: boolean;
};

const initialState: LocationState = {
  selectedCity: DEFAULT_SELECTED_CITY,
  hydrated: false,
};

export function readStoredSelectedCity(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage
      .getItem(SELECTED_CITY_STORAGE_KEY)
      ?.trim();
    return value || null;
  } catch {
    return null;
  }
}

export function writeStoredSelectedCity(city: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SELECTED_CITY_STORAGE_KEY, city);
  } catch {
    // Ignore quota / private-mode failures; in-memory Redux still works.
  }
}

const locationSlice = createSlice({
  name: "location",
  initialState,
  reducers: {
    hydrateSelectedCity(state, action: PayloadAction<string | null>) {
      if (action.payload) {
        state.selectedCity = action.payload;
      }
      state.hydrated = true;
    },
    setSelectedCity(state, action: PayloadAction<string>) {
      const next = action.payload.trim();
      if (!next) return;
      state.selectedCity = next;
    },
  },
});

export const { hydrateSelectedCity, setSelectedCity } = locationSlice.actions;
export const locationReducer = locationSlice.reducer;
