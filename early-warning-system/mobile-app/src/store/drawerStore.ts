import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface DrawerState {
  isOpen: boolean;
  /** Last drawer destination href for “remember selected screen”. */
  lastDrawerHref: string;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setLastDrawerHref: (href: string) => void;
}

export const useDrawerStore = create<DrawerState>()(
  persist(
    (set) => ({
      isOpen: false,
      lastDrawerHref: "/",
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      setLastDrawerHref: (href) => set({ lastDrawerHref: href }),
    }),
    {
      name: "ew-drawer-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ lastDrawerHref: state.lastDrawerHref }),
    },
  ),
);
