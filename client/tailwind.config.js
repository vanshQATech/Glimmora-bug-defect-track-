/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#faf6f1',
          100: '#f3e9dc',
          200: '#e6d0b3',
          300: '#d4b081',
          400: '#c08e57',
          500: '#a6743d',
          600: '#8b5e3c',
          700: '#6f4a30',
          800: '#523626',
          900: '#3a261b',
          950: '#1f1410',
        },
        ink: {
          50:  '#f7f6f4',
          100: '#edeae4',
          200: '#d8d3c9',
          300: '#b6ae9e',
          400: '#8a8170',
          500: '#5f574a',
          600: '#433d34',
          700: '#2e2a24',
          800: '#1d1a16',
          900: '#100e0b',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(29,26,22,0.04), 0 1px 3px 0 rgba(29,26,22,0.06)',
        pop:  '0 10px 30px -10px rgba(139,94,60,0.25), 0 4px 12px -4px rgba(29,26,22,0.08)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #8b5e3c 0%, #c08e57 100%)',
        'brand-radial': 'radial-gradient(1200px 600px at 0% 0%, rgba(192,142,87,0.12), transparent 60%), radial-gradient(1000px 500px at 100% 100%, rgba(139,94,60,0.10), transparent 60%)',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: 0, transform: 'translateY(4px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
      },
    },
  },
  plugins: [],
};
