/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // ── UI chrome (buttons, nav, logo) ──────────────────────────────────
        brand: '#0F766E',

        // ── Risk status indicators ONLY — never on UI chrome ────────────────
        'status-normal': '#22C55E',
        'status-medium': '#F59E0B',
        'status-high':   '#F97316',
        'status-severe': '#DC2626',

        // ── Surface & semantic tokens ────────────────────────────────────────
        bg:          '#F8FAFC',
        surface:     '#FFFFFF',
        border:      '#E2E8F0',
        text:        '#1E293B',
        'text-muted': '#64748B',
      },
      borderRadius: {
        lg: '0.5rem',
        md: 'calc(0.5rem - 2px)',
        sm: 'calc(0.5rem - 4px)',
      },
      boxShadow: {
        // Rules: shadow-sm for cards, nothing heavier
        card: '0 1px 3px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [],
}
