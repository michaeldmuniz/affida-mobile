/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#09090F',
          surface: '#13131B',
          elevated: '#1A1A24',
          border: '#1E1E2A',
          accent: '#5B7BF8',
          muted: '#6B7280',
          text: '#F0F0FA',
          positive: '#34D399',
          negative: '#F87171',
        },
      },
      fontFamily: {
        mono: ['SpaceMono', 'monospace'],
      },
    },
  },
  plugins: [],
}
