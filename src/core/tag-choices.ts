import { sameTag, tagOfTyped } from './tags';

/** A tag the card's type-ahead offers: one of the list's, or `isNew` for the typed one. */
export type TagChoice = { tag: string; isNew: boolean };

/**
 * What the type-ahead offers for `typed`: the `listTags` that contain it, ignoring case and a leading
 * `#` (all of them for empty text), in their order, then the typed tag as new when neither `listTags`
 * nor `itemTags` has it. A tag the item already has is never offered.
 */
export function tagChoices(listTags: readonly string[], itemTags: readonly string[], typed: string): TagChoice[] {
	const typedTag = tagOfTyped(typed);
	const needle = (typedTag ?? typed.trim()).toLowerCase();
	const isOwn = (tag: string) => itemTags.some((own) => sameTag(own, tag));
	const choices = listTags.filter((tag) => tag.toLowerCase().includes(needle) && !isOwn(tag)).map((tag) => ({ tag, isNew: false }));
	if (typedTag !== null && !isOwn(typedTag) && !listTags.some((tag) => sameTag(tag, typedTag))) choices.push({ tag: typedTag, isNew: true });
	return choices;
}
