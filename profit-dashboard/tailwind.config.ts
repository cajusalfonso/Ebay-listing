import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        profit: {
          DEFAULT: "#16a34a",
          light: "#dcfce7",
        },
        loss: {
          DEFAULT: "#dc2626",
          light: "#fee2e2",
        },
        brand: {
          DEFAULT: "#4f46e5",
          dark: "#3730a3",
        },
      },
    },
  },
  plugins: [],
};

export default config;
