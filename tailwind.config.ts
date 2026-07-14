import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        ink: '#0c1611',
        'ink-soft': '#28332c',
        muted: '#6d7a72',
        volt: '#10d96a',
        'volt-deep': '#0a9e4c',
        'volt-soft': '#e4faee',
        'surface-0': '#ffffff',
        'surface-1': '#f5f6f5',
        'surface-2': '#ebebeb',
        border: '#e0e3e1',
        danger: '#dc2626',
        'danger-soft': '#fef2f2',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
      },
      height: {
        control: 'var(--height-control)',
      },
      borderRadius: {
        token: 'var(--radius)',
        'token-sm': 'var(--radius-sm)',
        'token-lg': 'var(--radius-lg)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        float: 'var(--shadow-float)',
      },
    }
  },
  plugins: []
};

export default config;
