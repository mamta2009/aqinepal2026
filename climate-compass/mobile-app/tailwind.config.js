/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        forest: {
          DEFAULT: "#1f794b",
          dark: "#155936",
        },
        leaf: "#54b260",
        sky: {
          DEFAULT: "#9ad6f2",
          soft: "#e8f7fd",
        },
        "alert-red": "#c02e2f",
        surface: {
          DEFAULT: "#f8fcfd",
          tint: "#eef8f2",
          dark: "#f8fcfd",
        },
        ink: {
          DEFAULT: "#173244",
          soft: "#334f5d",
        },
        muted: "#526b78",
        border: {
          DEFAULT: "#d8e5e9",
          strong: "#b9ced5",
        },
        link: "#176b8c",
        aq: {
          good: "#287a47",
          moderate: "#b8860b",
          sensitive: "#c2410c",
          unhealthy: "#a92327",
        },
        // Legacy aliases so existing classNames keep working during migration.
        primary: {
          DEFAULT: "#1f794b",
          light: "#54b260",
          dark: "#155936",
        },
        secondary: {
          DEFAULT: "#176b8c",
          light: "#9ad6f2",
        },
        accent: "#54b260",
        success: "#287a47",
        warning: "#b8860b",
        blockchain: "#176b8c",
        ai: "#176b8c",
      },
      fontFamily: {
        display: ["System"],
        mono: ["Space Mono"],
      },
    },
  },
  plugins: [],
};
