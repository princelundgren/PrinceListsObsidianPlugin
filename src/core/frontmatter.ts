import { MARKER_KEY } from '../constants';
import { lineIndexAt } from './lines';

export function isMarkerValue(yaml: unknown): boolean {
	return typeof yaml === 'object' && yaml !== null && (yaml as Record<string, unknown>)[MARKER_KEY] === true;
}

const OPENING_DELIMITER = /^---(\r\n|\n|\r)/;

// Frontmatter counts only at byte 0: `from`, where its contents start, must follow a leading `---` line.
export function opensWithFrontmatter(text: string, from: number): boolean {
	return OPENING_DELIMITER.exec(text)?.[0].length === from;
}

// `contentStart` may fall on either side of the closing `---` line's break, so it is mapped from
// the character before it, which is always on that line.
export function lineAfterFrontmatter(text: string, contentStart: number): number {
	return lineIndexAt(text, contentStart - 1) + 1;
}

// Empty frontmatter, or frontmatter holding only comments, parses to null, and a key can go in it.
export function isYamlMapping(yaml: unknown): boolean {
	return yaml === null || (typeof yaml === 'object' && !Array.isArray(yaml));
}
