// import { Config } from "tailwindcss"; // Not needed in JS config

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",
        border: "var(--border)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
      },
    },
  },
  plugins: [],
}
