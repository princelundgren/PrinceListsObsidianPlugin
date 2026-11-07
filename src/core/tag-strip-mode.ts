/** Where a list and the Schedule show their tag strip, as the settings' dropdown stores it. */
export const TAG_STRIP_MODES = ['always', 'filtering'] as const;
export type TagStripMode = (typeof TAG_STRIP_MODES)[number];

export const DEFAULT_TAG_STRIP_MODE: TagStripMode = 'always';

/** A stored setting as one of the choices: the default when it is none of them. */
export function tagStripModeOf(stored: unknown): TagStripMode {
	return TAG_STRIP_MODES.find((mode) => mode === stored) ?? DEFAULT_TAG_STRIP_MODE;
}
