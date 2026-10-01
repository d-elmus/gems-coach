/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // Classes construites dynamiquement (`pill-${tone}`) : à garder même si absentes du code en clair.
  safelist: ['pill-good', 'pill-warn', 'pill-bad', 'pill-neutral', 'pill-red'],
  theme: {
    extend: {
      colors: {
        red: { DEFAULT: '#931621', dark: '#6B0F18' },
        cyan: { DEFAULT: '#22C5D5' },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
