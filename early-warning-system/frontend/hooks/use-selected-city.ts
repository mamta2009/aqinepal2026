"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  DEFAULT_SELECTED_CITY,
  setSelectedCity,
  writeStoredSelectedCity,
} from "@/lib/store/location-slice";

/**
 * Shared place selection for location-based views (dashboard, alerts, …).
 * Persists to Redux and localStorage so the choice survives refresh and navigation.
 *
 * Until the component has mounted on the client, always exposes the default city
 * so SSR markup matches the first client paint (avoids hydration mismatch when
 * localStorage / a live Redux store already has a different city).
 */
export function useSelectedCity() {
  const dispatch = useAppDispatch();
  const storedCity = useAppSelector((state) => state.location.selectedCity);
  const hydrated = useAppSelector((state) => state.location.hydrated);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateSelectedCity = useCallback(
    (city: string) => {
      const next = city.trim();
      if (!next) return;
      dispatch(setSelectedCity(next));
      writeStoredSelectedCity(next);
    },
    [dispatch],
  );

  return {
    selectedCity: mounted ? storedCity : DEFAULT_SELECTED_CITY,
    hydrated: hydrated && mounted,
    setSelectedCity: updateSelectedCity,
  };
}
