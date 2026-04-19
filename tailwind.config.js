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
        bg: '#F4F6FB',
        surface: '#FFFFFF',
        'surface-muted': '#F8FAFF',
        border: '#D6DCEB',
        text: '#1D2433',
        'text-muted': '#667089',
        accent: '#B63A30',
        disabled: '#C8D0E0',
        wolf: '#C43D31',
        village: '#6E9D6A',
      },
      borderRadius: {
        '2xl': '16px',
      },
    },
  },
  plugins: [],
};
