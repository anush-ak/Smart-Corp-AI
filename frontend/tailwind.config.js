/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono Variable', 'JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        /* ---- Neutrals: the canvas of the product ------------------------- */
        canvas: '#FAFAFB',
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F6F7F9',
          sunken: '#F1F2F5',
          inverse: '#15171C',
        },
        ink: {
          DEFAULT: '#15171C',
          900: '#15171C',
          800: '#262A32',
          700: '#3A3F4A',
          600: '#4E545F',
          500: '#666D7A',
          400: '#868D9A',
          300: '#A6ACB8',
          200: '#C4C9D2',
        },
        line: {
          DEFAULT: '#E3E6EB',
          subtle: '#EEF0F3',
          strong: '#CFD4DC',
        },

        /* ---- Brand: one restrained accent -------------------------------- */
        brand: {
          50: '#EEF0FF',
          100: '#E0E3FF',
          200: '#C6CBFF',
          300: '#A5AAFC',
          400: '#8189F8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
        },

        /* ---- Semantic ---------------------------------------------------- */
        success: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
        },
        warning: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
        },
        danger: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
        },
        info: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
        },
        /* Agent identity accent — used sparingly, never decoratively */
        agent: {
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          600: '#7C3AED',
          700: '#6D28D9',
        },
      },

      /* ---- Typography scale: hierarchy carries the design ---------------- */
      fontSize: {
        display: ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.022em', fontWeight: '600' }],
        h1: ['1.375rem', { lineHeight: '1.75rem', letterSpacing: '-0.018em', fontWeight: '600' }],
        h2: ['1.0625rem', { lineHeight: '1.5rem', letterSpacing: '-0.012em', fontWeight: '600' }],
        h3: ['0.9375rem', { lineHeight: '1.375rem', letterSpacing: '-0.006em', fontWeight: '600' }],
        body: ['0.875rem', { lineHeight: '1.375rem' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.25rem' }],
        caption: ['0.75rem', { lineHeight: '1rem' }],
        label: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.06em', fontWeight: '600' }],
        'mono-sm': ['0.75rem', { lineHeight: '1.125rem' }],
      },

      boxShadow: {
        xs: '0 1px 2px 0 rgba(21, 23, 28, 0.04)',
        card: '0 1px 2px 0 rgba(21, 23, 28, 0.04), 0 1px 1px -1px rgba(21, 23, 28, 0.03)',
        pop: '0 12px 28px -8px rgba(21, 23, 28, 0.16), 0 2px 6px -2px rgba(21, 23, 28, 0.07)',
        modal: '0 32px 64px -16px rgba(21, 23, 28, 0.26), 0 4px 12px -4px rgba(21, 23, 28, 0.08)',
        inset: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.06)',
      },

      borderRadius: {
        xs: '3px',
        sm: '5px',
        DEFAULT: '7px',
        md: '9px',
        lg: '11px',
        xl: '14px',
      },

      spacing: {
        4.5: '1.125rem',
        13: '3.25rem',
        15: '3.75rem',
        18: '4.5rem',
        22: '5.5rem',
      },

      maxWidth: {
        content: '1440px',
        prose: '68ch',
      },

      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },

      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-down': {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.975)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(12px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        'sheet-up': {
          from: { transform: 'translateY(10px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        indeterminate: {
          '0%': { transform: 'translateX(-110%)' },
          '100%': { transform: 'translateX(320%)' },
        },
        'draw-line': { from: { strokeDashoffset: '1' }, to: { strokeDashoffset: '0' } },
      },

      animation: {
        'fade-in': 'fade-in 0.16s ease-out both',
        'fade-in-up': 'fade-in-up 0.22s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in-down': 'fade-in-down 0.18s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 0.14s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-in-right': 'slide-in-right 0.22s cubic-bezier(0.22, 1, 0.36, 1) both',
        'sheet-up': 'sheet-up 0.24s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.7s infinite',
        'pulse-soft': 'pulse-soft 1.9s ease-in-out infinite',
        indeterminate: 'indeterminate 1.5s cubic-bezier(0.65, 0, 0.35, 1) infinite',
      },
    },
  },
  plugins: [],
}
