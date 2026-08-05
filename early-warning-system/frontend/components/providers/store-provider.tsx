"use client";

import { useEffect, useRef } from "react";
import { Provider } from "react-redux";
import { makeStore, type AppStore } from "@/lib/store";
import {
  hydrateSelectedCity,
  readStoredSelectedCity,
} from "@/lib/store/location-slice";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = makeStore();
  }
  const store = storeRef.current;

  useEffect(() => {
    store.dispatch(hydrateSelectedCity(readStoredSelectedCity()));
  }, [store]);

  return <Provider store={store}>{children}</Provider>;
}
