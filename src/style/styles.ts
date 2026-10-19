import * as stylex from '@stylexjs/stylex'

import { tokens } from './tokens.stylex'

/**
 * The app's component styles. Every rule compiles to a single atomic class,
 * so two components that share a property share a class rather than
 * duplicating the declaration.
 */
export const styles = stylex.create({
  // SHELL

  app: {
    height: '100vh',
    width: '100vw',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: tokens.surfaceInset,
    color: tokens.textPrimary,
    fontFamily: 'Inter, sans-serif',
  },

  header: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '8px 12px',
    flexShrink: 0,
    zIndex: 30,
    backgroundColor: tokens.surface,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.borderSubtle,
  },

  headerRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },

  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },

  brandMark: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    fontSize: '18px',
    fontWeight: 700,
    color: tokens.surfaceInset,
    backgroundImage:
      'linear-gradient(to bottom right, #fbbf24, #f97316, #e11d48)',
  },

  brandText: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
  },

  brandTitle: {
    fontSize: '14px',
    fontWeight: 700,
    letterSpacing: '-0.025em',
    color: tokens.textStrong,
  },

  workspace: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    '@media (min-width: 64rem)': {
      flexDirection: 'row',
    },
  },

  // VIEWPORT

  viewport: {
    position: 'relative',
    flex: 1,
    width: '100%',
    height: '48vh',
    overflow: 'hidden',
    backgroundColor: tokens.surfaceInset,
    '@media (min-width: 64rem)': {
      height: '100%',
    },
  },

  viewportCanvas: {
    display: 'block',
    width: '100%',
    height: '100%',
  },

  hud: {
    position: 'absolute',
    top: '12px',
    left: '12px',
    maxWidth: '28rem',
    pointerEvents: 'none',
    zIndex: 10,
    '@media (min-width: 64rem)': {
      maxWidth: '28rem',
    },
  },

  hudCard: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    borderRadius: tokens.radius,
    pointerEvents: 'auto',
    backgroundColor: 'rgba(10, 15, 23, 0.84)',
    backdropFilter: 'blur(14px)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens.borderSubtle,
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  },

  hudHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },

  hudTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },

  hudStep: {
    padding: '2px 8px',
    borderRadius: '6px',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '12px',
    fontWeight: 700,
    color: tokens.surfaceInset,
    backgroundColor: tokens.accent,
  },

  hudTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: tokens.textStrong,
  },

  hudOp: {
    padding: '2px 6px',
    borderRadius: '4px',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '10px',
    color: tokens.cyan,
    backgroundColor: tokens.cyanDeep,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens.cyanBorder,
  },

  hudPillars: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '6px',
    paddingTop: '8px',
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: tokens.borderSubtle,
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '10px',
    '@media (min-width: 40rem)': {
      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    },
  },

  hudPillar: {
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens.borderSubtle,
  },

  hudPillarLabel: {
    display: 'block',
    color: tokens.cyan,
  },

  hudPillarValue: {
    display: 'block',
    color: tokens.textPrimary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  viewportToggles: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    display: 'flex',
    gap: '6px',
    pointerEvents: 'none',
    zIndex: 10,
    '@media (min-width: 40rem)': {
      flexDirection: 'row',
      alignItems: 'center',
    },
  },

  toggleBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px',
    borderRadius: tokens.radius,
    pointerEvents: 'auto',
    backgroundColor: 'rgba(10, 15, 23, 0.84)',
    backdropFilter: 'blur(14px)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens.borderSubtle,
  },

  viewportTelemetry: {
    position: 'absolute',
    bottom: '12px',
    left: '12px',
    right: '12px',
    pointerEvents: 'none',
    zIndex: 10,
    '@media (min-width: 40rem)': {
      right: 'auto',
    },
  },

  telemetryCard: {
    padding: '8px 14px',
    borderRadius: tokens.radius,
    pointerEvents: 'auto',
    backgroundColor: 'rgba(10, 15, 23, 0.84)',
    backdropFilter: 'blur(14px)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens.borderSubtle,
  },

  telemetryRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flexWrap: 'wrap',
    fontSize: '12px',
  },

  telemetryItem: {},

  telemetryLabel: {
    display: 'block',
    fontSize: '9px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: tokens.textMuted,
  },

  telemetryValuePrimary: {
    fontFamily: 'JetBrains Mono, monospace',
    fontWeight: 600,
    color: tokens.textStrong,
  },

  telemetryValueAccent: {
    fontFamily: 'JetBrains Mono, monospace',
    fontWeight: 600,
    color: tokens.accent,
  },

  telemetryValueEmerald: {
    fontFamily: 'JetBrains Mono, monospace',
    fontWeight: 600,
    color: tokens.emerald,
  },

  telemetryValueViolet: {
    fontFamily: 'JetBrains Mono, monospace',
    fontWeight: 600,
    color: tokens.violet,
  },

  // BUTTONS

  button: {
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
    color: tokens.textPrimary,
    backgroundColor: tokens.surfaceRaised,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    cursor: 'pointer',
    ':hover': {
      backgroundColor: tokens.surfaceHover,
    },
  },

  buttonGhost: {
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    color: tokens.textMuted,
    ':hover': {
      color: tokens.textStrong,
      backgroundColor: tokens.surfaceHover,
    },
  },

  buttonAccent: {
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
    borderColor: tokens.accentBorder,
    ':hover': {
      backgroundColor: 'rgba(245, 158, 11, 0.28)',
    },
  },

  buttonActive: {
    color: tokens.accent,
    backgroundColor: 'rgba(245, 158, 11, 0.3)',
    borderColor: 'rgba(245, 158, 11, 0.6)',
  },

  buttonEmerald: {
    color: tokens.emerald,
    backgroundColor: tokens.emeraldSoft,
    borderColor: tokens.emeraldBorder,
    ':hover': {
      backgroundColor: 'rgba(52, 211, 153, 0.22)',
    },
  },

  buttonPrimary: {
    flex: 1,
    padding: '10px 16px',
    borderRadius: tokens.radius,
    fontSize: '12px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: tokens.surfaceInset,
    cursor: 'pointer',
    backgroundImage: 'linear-gradient(to right, #f59e0b, #f97316)',
    boxShadow: '0 10px 15px -3px rgba(245, 158, 11, 0.2)',
    ':hover': {
      backgroundImage: 'linear-gradient(to right, #fbbf24, #fb923c)',
    },
    ':active': {
      transform: 'scale(0.99)',
    },
  },

  buttonSecondary: {
    padding: '10px 12px',
    borderRadius: tokens.radius,
    fontSize: '12px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: tokens.textPrimary,
    cursor: 'pointer',
    backgroundColor: tokens.surfaceRaised,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens.borderStrong,
    ':hover': {
      backgroundColor: tokens.surfaceHover,
    },
  },

  // STEPPER

  stepper: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '6px',
    paddingTop: '2px',
    '@media (min-width: 40rem)': {
      gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
    },
  },

  stepPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 8px',
    borderRadius: '6px',
    textAlign: 'left',
    cursor: 'pointer',
    color: tokens.textPrimary,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(30, 41, 59, 1)',
    ':hover': {
      borderColor: tokens.textFaint,
    },
  },

  stepPillCurrent: {
    backgroundColor: tokens.accentSoft,
    borderColor: tokens.accent,
    boxShadow: '0 0 15px rgba(245, 158, 11, 0.2)',
  },

  stepPillDone: {
    backgroundColor: tokens.emeraldSoft,
    borderColor: tokens.emeraldBorder,
  },

  stepDotCurrent: {
    width: '8px',
    height: '8px',
    borderRadius: '9999px',
    flexShrink: 0,
    backgroundColor: tokens.accent,
  },

  stepDotDone: {
    width: '8px',
    height: '8px',
    borderRadius: '9999px',
    flexShrink: 0,
    backgroundColor: tokens.emerald,
  },

  stepDotTodo: {
    width: '8px',
    height: '8px',
    borderRadius: '9999px',
    flexShrink: 0,
    backgroundColor: tokens.textFaint,
  },

  stepLabel: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '10px',
    fontWeight: 700,
    color: tokens.textPrimary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  // SIDEBAR

  sidebar: {
    width: '100%',
    height: '52vh',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    zIndex: 20,
    backgroundColor: tokens.surface,
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: tokens.borderSubtle,
    '@media (min-width: 64rem)': {
      width: '520px',
      height: '100%',
      borderTopWidth: '0',
      borderLeftWidth: '1px',
      borderLeftStyle: 'solid',
      borderLeftColor: tokens.borderSubtle,
    },
    '@media (min-width: 80rem)': {
      width: '560px',
    },
  },

  tabBar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
    gap: '4px',
    padding: '8px',
    flexShrink: 0,
    backgroundColor: tokens.surfaceInset,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.borderSubtle,
  },

  tab: {
    padding: '8px 4px',
    borderRadius: '8px',
    fontSize: '11px',
    fontWeight: 600,
    textAlign: 'center',
    cursor: 'pointer',
    color: tokens.textMuted,
    backgroundColor: 'transparent',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    ':hover': {
      color: tokens.textPrimary,
    },
  },

  tabActive: {
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
    borderColor: tokens.accentBorder,
  },

  panel: {
    flex: 1,
    overflowY: 'auto',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },

  section: {
    padding: '12px',
    borderRadius: tokens.radius,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens.borderSubtle,
  },

  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 700,
  },

  sectionTitleCyan: { color: tokens.cyan },
  sectionTitleAmber: { color: tokens.accent },
  sectionTitleEmerald: { color: tokens.emerald },
  sectionTitleViolet: { color: tokens.violet },
  sectionTitlePink: { color: tokens.pink },

  sectionDot: {
    width: '8px',
    height: '8px',
    borderRadius: '9999px',
    display: 'inline-block',
  },

  // FORM CONTROLS

  field: {
    marginBottom: '8px',
  },

  fieldHead: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    marginBottom: '4px',
  },

  fieldLabel: {
    color: tokens.textMuted,
  },

  fieldValue: {
    fontFamily: 'JetBrains Mono, monospace',
    color: tokens.accent,
  },

  selectRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },

  selectLabel: {
    fontSize: '11px',
    color: tokens.textMuted,
  },

  select: {
    padding: '4px 8px',
    borderRadius: '8px',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    color: tokens.textPrimary,
    backgroundColor: tokens.surfaceInset,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens.surfaceRaised,
  },

  // CARDS

  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '6px',
  },

  presetCard: {
    padding: '8px',
    borderRadius: tokens.radius,
    textAlign: 'left',
    cursor: 'pointer',
    color: tokens.textPrimary,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens.borderSubtle,
    ':hover': {
      borderColor: tokens.textFaint,
    },
  },

  presetCardActive: {
    backgroundColor: tokens.accentSoft,
    borderColor: tokens.accent,
  },

  presetName: {
    fontSize: '11px',
    fontWeight: 700,
    color: tokens.textStrong,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  presetTag: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '9px',
    color: tokens.cyan,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  // CODE

  codePanel: {
    padding: '10px',
    borderRadius: tokens.radius,
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    lineHeight: 1.625,
    overflowX: 'auto',
    backgroundColor: tokens.surfaceInset,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(30, 41, 59, 0.9)',
  },

  codeLine: {
    padding: '2px 8px',
    borderTopLeftRadius: '4px',
    borderBottomLeftRadius: '4px',
    color: '#cbd5e1',
  },

  codeLineActive: {
    backgroundColor: tokens.accentSoft,
    borderLeftWidth: '2px',
    borderLeftStyle: 'solid',
    borderLeftColor: tokens.accent,
    color: '#fef3c7',
  },

  codeGutter: {
    marginRight: '12px',
    color: tokens.textFaint,
    userSelect: 'none',
  },

  // TEA HISTORY

  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    maxHeight: '18rem',
    overflowY: 'auto',
    paddingRight: '4px',
  },

  historyRow: {
    width: '100%',
    padding: '8px',
    borderRadius: '8px',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: tokens.textMuted,
    backgroundColor: 'rgba(5, 8, 12, 0.8)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(30, 41, 59, 1)',
    ':hover': {
      borderColor: tokens.textFaint,
    },
  },

  historyRowCurrent: {
    color: tokens.textStrong,
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    borderColor: tokens.violet,
  },

  historyRevision: {
    fontWeight: 700,
    color: tokens.violet,
  },

  historyTag: {
    marginLeft: '4px',
    color: tokens.accent,
  },

  historySummary: {
    display: 'block',
    color: tokens.textMuted,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  // CONSTRAINTS

  findingError: {
    padding: '8px',
    borderRadius: '8px',
    backgroundColor: tokens.roseSoft,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens.roseBorder,
  },

  findingWarning: {
    padding: '8px',
    borderRadius: '8px',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens.accentBorder,
  },

  findingCodeError: {
    fontSize: '10px',
    fontWeight: 700,
    color: tokens.rose,
  },

  findingCodeWarning: {
    fontSize: '10px',
    fontWeight: 700,
    color: tokens.accent,
  },

  findingMessage: {
    marginTop: '2px',
    fontSize: '10px',
    color: tokens.textPrimary,
  },

  // TOAST

  toast: {
    position: 'absolute',
    top: '96px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 50,
    pointerEvents: 'none',
  },

  toastButton: {
    padding: '8px 16px',
    borderRadius: tokens.radius,
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '12px',
    color: '#fde68a',
    backgroundColor: 'rgba(10, 15, 23, 0.95)',
    backdropFilter: 'blur(12px)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens.accentBorder,
  },

  // EXPORT FOOTER

  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    flexShrink: 0,
    backgroundColor: tokens.surfaceInset,
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: tokens.borderSubtle,
  },

  // MISC

  mono: {
    fontFamily: 'JetBrains Mono, monospace',
  },

  muted: {
    color: tokens.textMuted,
  },

  faint: {
    color: tokens.textFaint,
  },

  truncated: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  small: {
    fontSize: '10px',
  },

  badge: {
    padding: '2px 6px',
    borderRadius: '4px',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '10px',
    borderWidth: '1px',
    borderStyle: 'solid',
  },

  badgeCyan: {
    color: tokens.cyan,
    backgroundColor: tokens.cyanSoft,
    borderColor: tokens.cyanBorder,
  },

  badgeViolet: {
    color: tokens.violet,
    backgroundColor: tokens.violetSoft,
    borderColor: tokens.violetBorder,
  },

  badgePink: {
    color: tokens.pink,
    backgroundColor: tokens.pinkSoft,
    borderColor: tokens.pinkBorder,
  },
})
