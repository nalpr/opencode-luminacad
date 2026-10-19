import * as stylex from '@stylexjs/stylex'

/**
 * A StyleX style set, narrowed to the compiled shape the runtime exposes.
 */
export type CompiledStyles = stylex.CompiledStyles

/**
 * Merges StyleX style sets into a single class attribute value.
 *
 * StyleX compiles each style set into atomic classes, and `props` merges the
 * sets, resolving the last one that defines a property. A `false` entry is
 * skipped, so a conditional style reads as
 * `className(styles.base, isActive && styles.active)`.
 */
export const className = (
  ...styles: ReadonlyArray<CompiledStyles | false | null | undefined>
): string => stylex.props(...styles).className ?? ''
