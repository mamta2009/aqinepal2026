# Climate Compass mobile app

Expo / React Native client for **Climate Compass** — the Nepal air quality and respiratory readiness platform.

Aligns with the web dashboard: city selection, live air (WAQI station AQI preferred; PM2.5 when available), heat, compare cities, illustrative 24h chart and 5-day forecast, recent alerts, stress sandbox, and environment overview.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Point the app at a running Climate Compass API (FastAPI). Use the project env / config pattern already used in `src/` (API base URL toward `http://127.0.0.1:8000` for local work).

3. Start Expo

   ```bash
   npx expo start
   ```

Then open a development build, Android emulator, iOS simulator, or Expo Go as shown in the CLI output.

## Product notes

- Headline air comes from the same backend resolver as web: **WAQI stations first**, WeatherAPI / RapidAPI as air fallback.
- Charts and compare views stay usable when only **station AQI** is present (no PM2.5 µg/m³).
- Not medical advice; illustrative series are demo shapes around the live reading.

## Learn more

- Product / API truth: [`../docs/guides/IMPLEMENTATION_SNAPSHOT.md`](../docs/guides/IMPLEMENTATION_SNAPSHOT.md)
- Expo docs: [https://docs.expo.dev/](https://docs.expo.dev/)
