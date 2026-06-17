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
        // Dynamic brand color (from CSS variable)
        'brand': {
          DEFAULT: 'var(--brand)',
          50: 'var(--brand-50)',
          100: 'var(--brand-100)',
          200: 'var(--brand-200)',
          300: 'var(--brand-300)',
          400: 'var(--brand-400)',
          500: 'var(--brand-500)',
          600: 'var(--brand-600)',
          700: 'var(--brand-700)',
          800: 'var(--brand-800)',
          900: 'var(--brand-900)',
          950: 'var(--brand-950)',
        },
        // Dynamic gold accent (from CSS variable)
        'gold': {
          DEFAULT: 'var(--gold)',
          50: 'var(--gold-50)',
          100: 'var(--gold-100)',
          200: 'var(--gold-200)',
          300: 'var(--gold-300)',
          400: 'var(--gold-400)',
          500: 'var(--gold-500)',
          600: 'var(--gold-600)',
          700: 'var(--gold-700)',
          800: 'var(--gold-800)',
          900: 'var(--gold-900)',
          950: 'var(--gold-950)',
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
        'glow-brand': '0 0 20px color-mix(in srgb, var(--brand) 15%, transparent)',
        'glow-gold': '0 0 20px color-mix(in srgb, var(--gold) 15%, transparent)',
        'glow-blue': '0 0 20px rgba(15, 31, 69, 0.3)',
      },
    },
  },
  plugins: [],
}
