import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0a",
        card: "#111111",
        border: "rgba(255,255,255,0.08)",
        accent: "#6366f1",
      },
      fontFamily: {
        sans: ["Geist Sans", "Inter", "sans-serif"],
        mono: ["Geist Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config
