/** What a key's name depends on. Obsidian's `Platform` fits it. */
export interface KeyPlatform {
	readonly isMobile: boolean;
	readonly isMacOS: boolean;
}

/**
 * Names a key pressed with the platform's modifier, as "Cmd+Enter" on macOS and "Ctrl+Enter" on
 * Windows and Linux. Null on mobile, which usually has no keyboard, even a tablet that has one.
 */
export function modKeyName(platform: KeyPlatform, key: string): string | null {
	if (platform.isMobile) return null;
	return `${platform.isMacOS ? 'Cmd' : 'Ctrl'}+${key}`;
}

/** A button's label with its key in parentheses after it, as "New item (Cmd+Enter)", or the label alone. */
export function labelWithKey(label: string, keyName: string | null): string {
	return keyName === null ? label : `${label} (${keyName})`;
}
