/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0f0f',
        surface: {
          DEFAULT: '#111827',
          light: '#1a2332',
          lighter: '#1e2d3d',
        },
        primary: {
          DEFAULT: '#2dd4bf',
          hover: '#14b8a6',
          active: '#0d9488',
          muted: '#134e4a',
        },
        accent: {
          DEFAULT: '#f59e0b',
          hover: '#d97706',
          light: '#fbbf24',
        },
        'text-primary': '#f0f5f5',
        'text-muted': '#94a3b8',
        'text-dim': '#64748b',
        glass: {
          DEFAULT: 'rgba(255, 255, 255, 0.05)',
          border: 'rgba(255, 255, 255, 0.10)',
          hover: 'rgba(255, 255, 255, 0.08)',
        },
      },
      fontSize: {
        '2xs': '0.625rem',
      },
      fontFamily: {
        display: ['Lobster', 'cursive'],
        heading: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'slide-in-right': 'slideInRight 0.3s ease-out forwards',
        'slide-in-up': 'slideInUp 0.3s ease-out forwards',
        'pulse-dot': 'pulseDot 2s infinite',
        'bounce-slow': 'bounceSlow 2s infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideInUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(1.5)' },
        },
        bounceSlow: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(45, 212, 191, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(45, 212, 191, 0.4)' },
        },
      },
    },
  },
  plugins: [],
}
