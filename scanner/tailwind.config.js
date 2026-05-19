/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef2ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
      },
      keyframes: {
        'slide-up': {
          from: { transform: 'translateY(100%)' },
          to:   { transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'scale-in': {
          from: { transform: 'scale(0.8)', opacity: '0' },
          to:   { transform: 'scale(1)',   opacity: '1' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
        'fade-in':  'fade-in 0.2s ease-out',
        'scale-in': 'scale-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [
    // Safe area insets for iPhone notch / home indicator
    ({ addUtilities }) => addUtilities({
      '.pb-safe-bottom': { paddingBottom: 'env(safe-area-inset-bottom, 1rem)' },
      '.pt-safe-top':    { paddingTop:    'env(safe-area-inset-top, 1.5rem)' },
    }),
  ],
};
