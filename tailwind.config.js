/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#FFFFFF',
        card: '#F7F8FC',
        border: '#D9DDE8',
        text: '#1E2433',
        muted: '#687089',
        wolf: '#C43D31',
        village: '#6E9D6A',
      },
    },
  },
  plugins: [],
};
