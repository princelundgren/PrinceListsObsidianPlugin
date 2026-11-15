import { inlineTags } from './item-tags';
import type { ListModel } from './parse';
import { isTagBody, sameTag } from './tags';

/** The tags an item counts as carrying besides its own: the list's, and its heading's. */
export interface InheritedTags {
	/** The list's tags, for an item in no section of `bySection`. */
	list: readonly string[];
	/** For each of the model's sections: the list's tags, then those of its heading, each once. */
	bySection: readonly (readonly string[])[];
}

/** No list tags and no heading tags. */
export const NO_INHERITED_TAGS: InheritedTags = { list: [], bySection: [] };

/** What each section inherits: `headingTexts[i]` is the raw text of section i's heading, null for the unnamed top section. */
export function inheritedTags(listTags: readonly string[], headingTexts: readonly (string | null)[]): InheritedTags {
	return {
		list: listTags,
		bySection: headingTexts.map((text) => distinct([...listTags, ...(text === null ? [] : inlineTags(text))])),
	};
}

/** `own` followed by the `inherited` tags it lacks, `own` keeping its spelling. */
export function carriedTags(own: readonly string[], inherited: readonly string[]): string[] {
	return distinct([...own, ...inherited]);
}

/** `tags` without each tag that is one of `listTags` or a parent of one (`work` for `work/acme`). */
export function withoutListTags(tags: readonly string[], listTags: readonly string[]): string[] {
	return tags.filter((tag) => !listTags.some((listTag) => sameTag(tag, listTag) || listTag.toLowerCase().startsWith(`${tag.toLowerCase()}/`)));
}

/** The tags inherited by the item on `line`: those of the section holding it, or the list's. */
export function inheritedFor(model: ListModel, inherited: InheritedTags, line: number): readonly string[] {
	const section = model.sections.findIndex(({ items }) => items.some((item) => item.titleLine === line));
	return inherited.bySection[section] ?? inherited.list;
}

/** The tags of a list's `tags` property as Obsidian reads them (`#work`): without the `#`, only those that are tags, each once. */
export function listTagsOf(fromObsidian: readonly string[] | null): string[] {
	return distinct((fromObsidian ?? []).map((tag) => tag.replace(/^#/, '')).filter(isTagBody));
}

function distinct(tags: readonly string[]): string[] {
	return tags.filter((tag, i) => tags.findIndex((other) => sameTag(other, tag)) === i);
}
