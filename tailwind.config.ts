import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        // Foundation v3 tokens
        ink: '#1a1f1c',
        'ink-soft': '#3a4139',
        muted: '#6b7269',
        green: '#1c6b47',
        'green-deep': '#124a30',
        'green-soft': '#e7f2ec',
        copper: '#b5642f',
        'copper-soft': '#f9ece1',
        danger: '#b3261e',
        'danger-soft': '#fbeceb',
        border: '#e3e0d6',
        'surface-page': '#faf9f5',
        'surface-card': '#ffffff',
        // Backward-compat aliases
        volt: '#1c6b47',
        'volt-deep': '#124a30',
        'volt-soft': '#e7f2ec',
        'surface-0': '#ffffff',
        'surface-1': '#faf9f5',
        'surface-2': '#e3e0d6',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
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
        elevated: 'var(--shadow-elevated)',
        card: 'none',
        float: 'var(--shadow-elevated)',
      },
    }
  },
  plugins: []
};

export default config;
