/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'cv-dark': '#1a1a2e',
        'cv-primary': '#16213e',
        'cv-accent': '#0f3460',
        'cv-highlight': '#e94560',
      }
    }
  },
  plugins: []
};
