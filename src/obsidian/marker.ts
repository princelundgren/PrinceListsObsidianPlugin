import { type FrontMatterInfo, getFrontMatterInfo, parseFrontMatterTags, parseYaml } from 'obsidian';
import { isMarkerValue, isYamlMapping, lineAfterFrontmatter, opensWithFrontmatter } from '../core/frontmatter';
import { listTagsOf } from '../core/inherited-tags';
import type { FrontmatterShape } from '../core/marker-edit';

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

/** The tags of the list's `tags` property, without their `#`: none when there is no property or the frontmatter isn't YAML. */
export function listTags(text: string): string[] {
	const info = leadingFrontmatter(text);
	if (!info) return [];
	try {
		const yaml: unknown = parseYaml(info.frontmatter);
		return isYamlMapping(yaml) ? listTagsOf(parseFrontMatterTags(yaml)) : [];
	} catch {
		// Frontmatter that isn't valid YAML has no tags.
		return [];
	}
}

export function contentStartLine(text: string): number {
	const info = leadingFrontmatter(text);
	return info ? lineAfterFrontmatter(text, info.contentStart) : 0;
}

export function readFrontmatter(text: string): FrontmatterShape | null {
	const info = leadingFrontmatter(text);
	if (!info) return null;
	const closingLine = lineAfterFrontmatter(text, info.contentStart) - 1;
	try {
		return { closingLine, isMapping: isYamlMapping(parseYaml(info.frontmatter)) };
	} catch {
		return { closingLine, isMapping: false };
	}
}

/** Whether every frontmatter property but `tags` (in any case) parses the same in both texts. */
export function sameButTags(before: string, after: string): boolean {
	const was = propertiesButTags(before);
	const now = propertiesButTags(after);
	if (!was || !now) return false;
	const keys = new Set([...Object.keys(was), ...Object.keys(now)]);
	return [...keys].every((key) => JSON.stringify(was[key]) === JSON.stringify(now[key]));
}

// null: no frontmatter, not YAML, or not a mapping.
function propertiesButTags(text: string): Record<string, unknown> | null {
	const info = leadingFrontmatter(text);
	if (!info) return null;
	try {
		const yaml: unknown = parseYaml(info.frontmatter);
		if (yaml === null) return {};
		if (!isYamlMapping(yaml)) return null;
		return Object.fromEntries(Object.entries(yaml as Record<string, unknown>).filter(([key]) => !/^tags$/i.test(key)));
	} catch {
		return null;
	}
}
