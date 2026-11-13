import { sameTag, tagOfTyped } from './tags';

/** A tag a type-ahead offers: one of the list's, or `isNew` for the typed one. */
export type TagChoice = { tag: string; isNew: boolean };

/**
 * What the type-ahead offers for `typed`: the `listTags` that contain it, ignoring case and a leading
 * `#` (all of them for empty text), in their order, then the typed tag as new when neither `listTags`
 * nor `leaveOut` has it. A tag in `leaveOut` is never offered.
 */
export function tagChoices(listTags: readonly string[], leaveOut: readonly string[], typed: string): TagChoice[] {
	const typedTag = tagOfTyped(typed);
	const needle = (typedTag ?? typed.trim()).toLowerCase();
	const isLeftOut = (tag: string) => leaveOut.some((other) => sameTag(other, tag));
	const choices = listTags.filter((tag) => tag.toLowerCase().includes(needle) && !isLeftOut(tag)).map((tag) => ({ tag, isNew: false }));
	if (typedTag !== null && !isLeftOut(typedTag) && !listTags.some((tag) => sameTag(tag, typedTag))) choices.push({ tag: typedTag, isNew: true });
	return choices;
}
