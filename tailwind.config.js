/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // REPTEC brand orange (#E3592B) — primary
        reptec: {
          50: '#FDF3EF',
          100: '#FBE6DC',
          200: '#F6CDB8',
          300: '#F0AE8B',
          400: '#E97D55',
          500: '#E3592B',
          600: '#C9491F',
          700: '#A83A18',
          800: '#87301A',
          900: '#6F2A18',
        },
        // REPTEC brand blue (#1863DC) — secondary
        brand: {
          50: '#EEF4FE',
          100: '#D9E5FD',
          200: '#B6CDFB',
          300: '#8AAFF8',
          400: '#5B8CF3',
          500: '#1863DC',
          600: '#1A4FB8',
          700: '#1A4091',
          800: '#1B3874',
          900: '#003D7C',
        },
      },
    },
  },
  plugins: [],
};
