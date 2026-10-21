import type { Line } from './lines';

// A one-off action writes through vault.process, so an outside change that landed since the view
// last read the file wins, and the action is dropped rather than written over it.
export function guardedApply(current: string, expected: string, next: string): string {
	return current === expected ? next : current;
}

// Where a line of the old text sits in the new one, or null when the edit replaced it. Lines compare
// by text, so an ending that changed at the end of the file doesn't count as a change.
export function mapLine(oldLines: readonly Line[], newLines: readonly Line[], line: number): number | null {
	const shorter = Math.min(oldLines.length, newLines.length);
	let prefix = 0;
	while (prefix < shorter && oldLines[prefix]?.text === newLines[prefix]?.text) prefix++;
	let suffix = 0;
	while (
		suffix < shorter - prefix &&
		oldLines[oldLines.length - 1 - suffix]?.text === newLines[newLines.length - 1 - suffix]?.text
	) {
		suffix++;
	}
	if (line < prefix) return line;
	if (line >= oldLines.length - suffix) return line + newLines.length - oldLines.length;
	return null;
}
