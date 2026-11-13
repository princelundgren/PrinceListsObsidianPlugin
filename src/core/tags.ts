// The one rule for what text after a `#` is a tag, as Obsidian reads it (Obsidian Help, "Tags").

const TAG_RUN = /^(?:[\p{L}\p{N}\p{M}_\-/\u200D]|(?!\p{ASCII})\p{S})+/u;
const NOT_NUMBER_OR_JOINER = /[^\p{N}\p{M}\u200D]/u;

/**
 * The tag body at the start of `text`, which is the text right after a `#`: the longest run of tag
 * characters. Null when there is none, or when it is only numbers, marks and joiners (`#1984`).
 */
export function tagBodyAt(text: string): string | null {
	const run = TAG_RUN.exec(text)?.[0];
	return run && NOT_NUMBER_OR_JOINER.test(run) ? run : null;
}

/** Whether all of `text` is a tag body, as `tagBodyAt` reads one. */
export function isTagBody(text: string): boolean {
	return tagBodyAt(text) === text;
}

/** Whether two tags are one tag: equal ignoring case, whatever the device's language. */
export function sameTag(a: string, b: string): boolean {
	return a.toLowerCase() === b.toLowerCase();
}

/** The tag a person typed, with or without its `#`, or null when it isn't one. */
export function tagOfTyped(typed: string): string | null {
	const trimmed = typed.trim();
	const body = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
	return isTagBody(body) ? body : null;
}

/** What the tag strip has lit. */
export interface LitTags {
	/** The lit tags: an item shows if it carries every one, or, with No tag lit, if it carries none. */
	readonly tags: readonly string[];
	/** No tag: the items with no tag show as well. */
	readonly untagged: boolean;
}

/** A strip with nothing lit. */
export const NO_LIT_TAGS: LitTags = { tags: [], untagged: false };

/** Whether a tag or No tag is lit. */
export function isAnyLit(lit: LitTags): boolean {
	return lit.tags.length > 0 || lit.untagged;
}

/**
 * Whether an item carrying `tags` shows for `lit`: with No tag lit, an item with no tag shows, and
 * so does one carrying every lit tag, once a tag is lit too.
 */
export function meetsLitTags(tags: readonly string[], lit: LitTags): boolean {
	if (!lit.untagged) return carriesTags(tags, lit.tags);
	return tags.length === 0 || (lit.tags.length > 0 && carriesTags(tags, lit.tags));
}

/**
 * What stays lit in a strip of `tags`: all of `lit`, or nothing once the strip has no tag, so No tag
 * never filters the rows of a list whose strip no longer shows.
 */
export function litForStrip(lit: LitTags, tags: readonly string[]): LitTags {
	return tags.length === 0 ? NO_LIT_TAGS : lit;
}

/** Whether `tags` meet every lit tag: each is one of them, or a parent of one (`shop` lit shows `shop/frozen`). */
export function carriesTags(tags: readonly string[], lit: readonly string[]): boolean {
	return lit.every((l) => tags.some((t) => sameTag(t, l) || t.toLowerCase().startsWith(`${l.toLowerCase()}/`)));
}

/** The tag strip's tags: those `carried` by the items, then `lit`, each tag once in the casing met first, sorted without regard to case. */
export function stripTags(carried: Iterable<readonly string[]>, lit: readonly string[]): string[] {
	const strip: string[] = [];
	for (const tags of [...carried, lit]) {
		for (const tag of tags) if (!strip.some((kept) => sameTag(kept, tag))) strip.push(tag);
	}
	return strip.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

/** `lit` without `tag` when it is lit, else with `tag` at the end. */
export function toggleTag(lit: readonly string[], tag: string): string[] {
	return lit.some((l) => sameTag(l, tag)) ? lit.filter((l) => !sameTag(l, tag)) : [...lit, tag];
}
