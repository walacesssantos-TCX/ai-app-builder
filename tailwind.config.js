/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Override zinc to match our dark luxury theme
        zinc: {
          50: '#FAF8F5',
          100: '#F0EDE6',
          200: '#D9D2C4',
          300: '#BFB5A0',
          400: '#A6987C',
          500: '#8C7C5E',
          600: '#6F6248',
          700: '#524734',
          800: '#352E20',
          900: '#1C1810',
          950: '#080705',
        },
        // Red accent (primary)
        'brand': {
          DEFAULT: '#CC0000',
          50: '#FFF0F0',
          100: '#FFD6D6',
          200: '#FFA8A8',
          300: '#FF7070',
          400: '#FF3838',
          500: '#CC0000',
          600: '#A30000',
          700: '#7A0000',
          800: '#520000',
          900: '#2B0000',
          950: '#140000',
        },
        // Gold accent
        'gold': {
          DEFAULT: '#C9950E',
          50: '#FEF8E7',
          100: '#FDEFC3',
          200: '#FBDF87',
          300: '#F7C940',
          400: '#D4A017',
          500: '#C9950E',
          600: '#A0770B',
          700: '#775809',
          800: '#4F3A06',
          900: '#281D03',
          950: '#140F01',
        },
        // Dark blue (secondary bg)
        'blue-deep': {
          DEFAULT: '#0A1628',
          50: '#EDF2FA',
          100: '#D1DDF0',
          200: '#A3BDE1',
          300: '#6F99D2',
          400: '#4178C3',
          500: '#325EA3',
          600: '#264A85',
          700: '#1C3667',
          800: '#0F1F45',
          900: '#0A1628',
          950: '#050C1A',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'glow-red': '0 0 20px rgba(204, 0, 0, 0.15)',
        'glow-gold': '0 0 20px rgba(201, 149, 14, 0.15)',
        'glow-blue': '0 0 20px rgba(15, 31, 69, 0.3)',
      },
    },
  },
  plugins: [],
}
