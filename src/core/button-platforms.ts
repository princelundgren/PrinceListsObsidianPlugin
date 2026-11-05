/** Where a button shows, as the settings' dropdown stores it. */
export const BUTTON_PLATFORMS = ['both', 'desktop', 'mobile', 'off'] as const;
export type ButtonPlatforms = (typeof BUTTON_PLATFORMS)[number];

/** Whether a button set to `platforms` shows on a device that is mobile or not. */
export function showsOn(platforms: ButtonPlatforms, isMobile: boolean): boolean {
	if (platforms === 'both') return true;
	if (platforms === 'off') return false;
	return (platforms === 'mobile') === isMobile;
}

/** A stored setting as one of the choices: `fallback` when it is none of them. */
export function buttonPlatformsOf(stored: unknown, fallback: ButtonPlatforms): ButtonPlatforms {
	return BUTTON_PLATFORMS.find((platforms) => platforms === stored) ?? fallback;
}
