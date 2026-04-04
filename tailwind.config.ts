import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        orange:  '#FF6B1A',
        'orange-dim': 'rgba(255,107,26,0.12)',
        'orange-mid': 'rgba(255,107,26,0.35)',
        card:    '#242424',
        card2:   '#2c2c2c',
        border:  '#2a2a2a',
        muted:   '#666666',
      },
      fontFamily: {
        display: ['var(--font-bebas)', 'sans-serif'],
        mono:    ['var(--font-dm-mono)', 'monospace'],
        sans:    ['var(--font-dm-sans)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
