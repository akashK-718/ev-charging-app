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
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};

export default config;
