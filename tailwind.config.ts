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
        'volt-soft': '#e4faee'
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-sans)', 'system-ui', 'sans-serif']
      },
      height: {
        control: 'var(--height-control)'
      },
      borderRadius: {
        token: 'var(--radius)'
      }
    }
  },
  plugins: []
};

export default config;
