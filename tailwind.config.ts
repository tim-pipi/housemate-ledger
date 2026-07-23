import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAFAF6",
        ink: "#1C2B35",
        inkmuted: "#5A6B75",
        line: "#E4E4DB",
        accent: "#0E7C6B",
        accentdark: "#0A5F52",
        accentsoft: "#E3F1EE",
        danger: "#B4423A",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
        body: ["'Inter'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(28,43,53,0.06), 0 4px 16px rgba(28,43,53,0.05)",
      },
    },
  },
  plugins: [],
} satisfies Config;
