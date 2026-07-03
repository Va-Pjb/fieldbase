import type { Config } from 'tailwindcss'

/**
 * FieldBase design tokens — locked in Phase 0, Task 4.
 * Identity: a field-service "work order" — warm work-order paper, blueprint
 * ink, dispatch blue, and a hi-vis marker lime as the signature accent.
 * Do not introduce new colors/fonts ad hoc elsewhere; extend this system.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Core identity (6)
        ink: { DEFAULT: '#14232b', soft: '#3a4a52' }, // blueprint ink — text + dark surfaces
        paper: { DEFAULT: '#f7f6f1', raised: '#ffffff', sunken: '#efeee7' }, // work-order paper
        brand: { DEFAULT: '#1b54c8', ink: '#0f3c97' }, // dispatch blue — primary
        signal: { DEFAULT: '#c7f24a', deep: '#93c013' }, // hi-vis marker lime — signature accent
        slate: '#5c6b72', // muted / secondary text
        line: '#d8dbd3', // hairline borders + field grid
        // Semantic (derived from the same industrial palette)
        positive: '#1e9e5a', // deal won / success
        danger: '#d2462f', // destructive / lost / error
      },
      fontFamily: {
        display: ['Archivo', 'system-ui', 'sans-serif'],
        body: ['"Public Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        display: ['2.75rem', { lineHeight: '1.04', letterSpacing: '-0.02em', fontWeight: '700' }],
        title: ['1.75rem', { lineHeight: '1.15', letterSpacing: '-0.01em', fontWeight: '700' }],
        heading: ['1.125rem', { lineHeight: '1.3', fontWeight: '600' }],
        body: ['1rem', { lineHeight: '1.6' }],
        small: ['0.875rem', { lineHeight: '1.5' }],
        label: ['0.72rem', { lineHeight: '1', letterSpacing: '0.14em', fontWeight: '600' }],
      },
      borderRadius: {
        DEFAULT: '6px',
        card: '10px',
      },
      letterSpacing: {
        wide: '0.14em',
      },
    },
  },
  plugins: [],
} satisfies Config
