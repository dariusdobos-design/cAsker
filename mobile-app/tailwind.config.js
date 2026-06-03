/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        casker: {
          navy: "#0b194f",
          "navy-light": "#152a6e",
          slate: "#1e293b",
        },
      },
    },
  },
  plugins: [],
};
