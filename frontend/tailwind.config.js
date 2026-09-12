/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#06070A",
        panel: "#0E1116",
        ink: "#E6EAF0",
        muted: "#8A93A3",
        line: "#232833",
        blueprint: "#4FC3F7",
        "blueprint-soft": "#0F1E2A",
        recent: "#34D399",
        old: "#64748B",
        uncommitted: "#60A5FA",
      },
      fontFamily: {
        sans: [
          '"Segoe UI"',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          "system-ui",
          "sans-serif",
        ],
        mono: ['"JetBrains Mono"', '"Cascadia Code"', "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
