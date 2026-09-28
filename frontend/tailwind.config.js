/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          900: '#070d18',
          800: '#0f172a',
          700: '#1e293b',
          600: '#334155',
          accent: '#06b6d4',
          glow: '#38bdf8'
        }
      }
    },
  },
  plugins: [],
}
