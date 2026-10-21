import { type FrontMatterInfo, getFrontMatterInfo, parseYaml } from 'obsidian';
import { isMarkerValue, lineAfterFrontmatter, opensWithFrontmatter } from '../core/frontmatter';

// Read from the text, not the metadata cache: getFileCache returns null for a file that isn't
// cached yet, such as one Sync just wrote.
function leadingFrontmatter(text: string): FrontMatterInfo | null {
	const info = getFrontMatterInfo(text);
	return info.exists && opensWithFrontmatter(text, info.from) ? info : null;
}

export function isListText(text: string): boolean {
	const info = leadingFrontmatter(text);
	if (!info) return false;
	try {
		return isMarkerValue(parseYaml(info.frontmatter));
	} catch {
		// Frontmatter that isn't valid YAML has no marker.
		return false;
	}
}

export function contentStartLine(text: string): number {
	const info = leadingFrontmatter(text);
	return info ? lineAfterFrontmatter(text, info.contentStart) : 0;
}
