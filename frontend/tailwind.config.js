/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F5F3EE",
        panel: "#FBFAF7",
        ink: "#23252B",
        muted: "#6B6F76",
        line: "#D9D5CC",
        blueprint: "#2F5D8C",
        "blueprint-soft": "#E3EAF2",
        recent: "#22c55e",
        old: "#64748b",
        uncommitted: "#3b82f6",
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
