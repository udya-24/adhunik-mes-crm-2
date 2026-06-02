import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#eef4ff",
          100: "#d9e8ff",
          200: "#bcd5ff",
          500: "#285fa8",
          600: "#1f4f92",
          700: "#173b71",
          900: "#0b1f3a"
        },
        amber: {
          50: "#fffbeb",
          100: "#fef3c7",
          500: "#d69a19",
          600: "#b77912"
        },
        orange: {
          50: "#fff7ed",
          100: "#ffedd5",
          500: "#f97316",
          600: "#ea580c"
        },
        border: "#e2e8f0",
        background: "#ffffff",
        foreground: "#101828"
      },
      boxShadow: {
        soft: "0 12px 34px rgba(15, 23, 42, 0.08)",
        lift: "0 20px 55px rgba(15, 23, 42, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
