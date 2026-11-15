import { asInline } from './inline';
import { parseItemLine, splitTail, tailFields } from './item-line';
import { obsidianMarkdown } from './obsidian-markdown';
import { splitStar } from './star';
import { isTagBody, sameTag } from './tags';

/**
 * The tags of an item line, without their `#`: `tailTags` are the tail's, `tags` are the title's as
 * the renderer draws it followed by `tailTags`. Each list keeps the first of tags that are one tag.
 * Both are empty for a line that isn't an item.
 */
export function itemTags(line: string): { tags: string[]; tailTags: string[] } {
	const parts = parseItemLine(line);
	if (!parts) return { tags: [], tailTags: [] };
	const { fields } = splitTail(parts.tail);
	const tailTags = tailFields(fields).flatMap(({ from, to }) => {
		const body = fields.slice(from + 1, to);
		return fields.charAt(from) === '#' && isTagBody(body) ? [body] : [];
	});
	return { tags: distinct([...inlineTags(splitStar(parts.title).plain), ...tailTags]), tailTags: distinct(tailTags) };
}

/**
 * The tags in Markdown text as the renderer draws it, without their `#`, each once. Text with no
 * `#` isn't parsed: a parse per item runs several times per redraw.
 */
export function inlineTags(text: string): string[] {
	if (!text.includes('#')) return [];
	const inline = asInline(text);
	const found: string[] = [];
	obsidianMarkdown.parse(inline).iterate({
		enter: (node) => {
			if (node.name === 'Tag') found.push(inline.slice(node.from + 1, node.to));
		},
	});
	return distinct(found);
}

function distinct(tags: string[]): string[] {
	return tags.filter((tag, i) => tags.findIndex((other) => sameTag(other, tag)) === i);
}
