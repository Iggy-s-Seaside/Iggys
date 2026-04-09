/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          hover: 'var(--color-surface-hover)',
          active: 'var(--color-surface-active)',
        },
        border: 'var(--color-border)',
        primary: {
          DEFAULT: '#2dd4bf',
          hover: '#14b8a6',
          dark: '#0d9488',
          light: '#99f6e4',
          50: 'var(--color-primary-50)',
        },
        accent: {
          DEFAULT: '#f59e0b',
          hover: '#d97706',
          light: '#fbbf24',
        },
        danger: {
          DEFAULT: '#ef4444',
          hover: '#dc2626',
          light: 'var(--color-danger-light)',
        },
        success: {
          DEFAULT: '#22c55e',
          light: 'var(--color-success-light)',
        },
        warning: {
          DEFAULT: '#f59e0b',
          light: 'var(--color-warning-light)',
        },
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',
      },
      fontFamily: {
        body: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        modal: 'var(--shadow-modal)',
      },
    },
  },
  plugins: [],
}
