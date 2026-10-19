import * as stylex from '@stylexjs/stylex'

/**
 * The design tokens. StyleX compiles each entry into a CSS custom property
 * on `:root` and a stable hashed class, so a theme swap is one variable
 * change rather than a re-render of every element.
 */
export const tokens = stylex.defineVars({
  accent: '#f59e0b',
  accentSoft: 'rgba(245, 158, 11, 0.16)',
  accentBorder: 'rgba(245, 158, 11, 0.45)',

  cyan: '#22d3ee',
  cyanSoft: 'rgba(34, 211, 238, 0.15)',
  cyanBorder: 'rgba(34, 211, 238, 0.4)',
  cyanDeep: '#083344',

  violet: '#a78bfa',
  violetSoft: 'rgba(167, 139, 250, 0.15)',
  violetBorder: 'rgba(167, 139, 250, 0.4)',

  emerald: '#34d399',
  emeraldSoft: 'rgba(52, 211, 153, 0.12)',
  emeraldBorder: 'rgba(52, 211, 153, 0.35)',

  rose: '#fb7185',
  roseSoft: 'rgba(251, 113, 133, 0.12)',
  roseBorder: 'rgba(251, 113, 133, 0.4)',

  pink: '#f472b6',
  pinkSoft: 'rgba(244, 114, 182, 0.15)',
  pinkBorder: 'rgba(244, 114, 182, 0.3)',

  textPrimary: '#f1f5f9',
  textStrong: '#ffffff',
  textMuted: '#94a3b8',
  textFaint: '#64748b',

  surface: '#0a0f16',
  surfaceRaised: '#131b26',
  surfacePanel: 'rgba(15, 23, 42, 0.9)',
  surfaceInset: '#05080c',
  surfaceHover: '#1d293d',

  borderSubtle: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.14)',

  radius: '12px',
  radiusSmall: '8px',
  radiusLarge: '16px',
})
