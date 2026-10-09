import { configureStore } from "@reduxjs/toolkit";
import { locationReducer } from "./location-slice";

export function makeStore() {
  return configureStore({
    reducer: {
      location: locationReducer,
    },
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
