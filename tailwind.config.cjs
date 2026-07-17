/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3b82f6', // modern blue
          dark: '#2563eb'
        },
        dark: {
          bg: '#121212',
          surface: '#1e1e1e',
          border: '#333333'
        },
        light: {
          bg: '#f9fafb',
          surface: '#ffffff',
          border: '#e5e7eb'
        }
      }
    },
  },
  plugins: [],
  darkMode: 'class',
}
