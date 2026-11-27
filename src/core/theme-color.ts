/** A color as the settings' dropdowns store it: none, or one of Obsidian's theme colors. */
export const THEME_COLORS = ['none', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'] as const;
export type ThemeColor = (typeof THEME_COLORS)[number];

/** A stored color as one of the choices: `fallback` when it is none of them. */
export function themeColorOf(stored: unknown, fallback: ThemeColor): ThemeColor {
	return THEME_COLORS.find((color) => color === stored) ?? fallback;
}
