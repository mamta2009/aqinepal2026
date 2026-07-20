/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Ported from early-warning-system/frontend/index.html :root variables,
        // so the mobile UI matches the web dashboard's brand system.
        primary: {
          DEFAULT: "#d32f2f",
          light: "#ef5350",
          dark: "#b71c1c",
        },
        secondary: {
          DEFAULT: "#1565c0",
          light: "#1976d2",
        },
        accent: "#ffd600",
        success: "#2e7d32",
        warning: "#f59e0b",
        blockchain: "#7c3aed",
        ai: "#06b6d4",
        surface: {
          DEFAULT: "#1a1f26",
          dark: "#0f1419",
        },
      },
      fontFamily: {
        display: ["Outfit"],
        mono: ["Space Mono"],
      },
    },
  },
  plugins: [],
};
