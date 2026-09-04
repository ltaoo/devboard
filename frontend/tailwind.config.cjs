/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./app/**/*.{js,css}"],
  darkMode: "class",
  theme: {
    extend: {
      height: { "w-screen": "var(--hh)" },
      colors: {
        "w-bg-0": "var(--weui-BG-0)",
        "w-bg-1": "var(--weui-BG-1)",
        "w-bg-2": "var(--weui-BG-2)",
        "w-bg-3": "var(--weui-BG-3)",
        "w-bg-4": "var(--weui-BG-4)",
        "w-bg-5": "var(--weui-BG-5)",
        "w-bg-active": "var(--weui-BG-COLOR-ACTIVE)",
        "w-fg-0": "var(--weui-FG-0)",
        "w-fg-1": "var(--weui-FG-1)",
        "w-fg-2": "var(--weui-FG-2)",
        "w-fg-3": "var(--weui-FG-3)",
        "w-fg-4": "var(--weui-FG-4)",
        "w-fg-5": "var(--weui-FG-5)",
        "w-red": "var(--weui-RED)",
        "w-green": "var(--weui-GREEN)",
        "w-brand": "var(--weui-BRAND)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
