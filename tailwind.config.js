/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#070a0f',
          900: '#0c1017',
          850: '#111723',
          800: '#172030',
          700: '#212d42',
          600: '#2d3d59'
        },
        mcgreen: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857'
        }
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
        mono: ['var(--font-fira-code)', 'monospace']
      }
    },
  },
  plugins: [],
};
