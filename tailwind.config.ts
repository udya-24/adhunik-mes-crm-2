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
          500: "#285fa8",
          700: "#173b71",
          900: "#0b1f3a"
        },
        amber: {
          500: "#d69a19",
          600: "#b77912"
        },
        border: "#d9dee8",
        background: "#f7f9fc",
        foreground: "#101828"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
