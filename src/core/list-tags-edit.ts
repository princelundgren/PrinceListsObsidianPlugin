import type { TagChange } from './group-menu';
import { splitLines } from './lines';
import type { FrontmatterShape, MarkerEdit } from './marker-edit';
import { sameTag } from './tags';

export type ListTagsRefusal = { refused: 'not-a-mapping' | 'unreadable' };

// The key in any letter case, plain or quoted, with spaces before the colon.
const TAGS_KEY_LINE = /^((?:tags|"tags"|'tags')[ \t]*:)(.*)$/i;
const BLOCK_ITEM = /^([ \t]*)-[ \t]+(.+)$/;
const QUOTED = /"[^"]*"|'[^']*'/g;
// A `#` that opens a comment: at the start or after a space, outside quotes.
const COMMENT = /(^|\s)#/;
// Starts a YAML anchor, alias, tag, block scalar, directive or flow collection.
const NOT_PLAIN_START = /^[&*!|>%@`[\]{}]/;

interface Entry {
	raw: string;
	tag: string;
}

type TagsProperty =
	| { form: 'single'; keyLine: number; prefix: string; entries: Entry[] }
	| { form: 'flow'; keyLine: number; prefix: string; entries: Entry[] }
	| { form: 'block'; keyLine: number; itemLines: number[]; indents: string[]; texts: string[]; entries: Entry[] };

/**
 * Plans adding `tag` to the list's `tags` property, or removing every spelling of it, line by line.
 * null: nothing to change. No frontmatter is 'not-a-mapping'.
 */
export function planListTags(text: string, frontmatter: FrontmatterShape | null, change: TagChange, tag: string): MarkerEdit | ListTagsRefusal | null {
	if (!frontmatter?.isMapping) return { refused: 'not-a-mapping' };
	const lines = splitLines(text).map((line) => line.text);
	const property = readTagsProperty(lines, frontmatter.closingLine);
	if (property === 'unreadable') return { refused: 'unreadable' };
	if (property === null) {
		return change === 'addTag' ? { start: frontmatter.closingLine, deleteCount: 0, insert: ['tags:', `  - ${tag}`] } : null;
	}
	if (property.entries.some((entry) => sameTag(entry.tag, tag)) === (change === 'addTag')) return null;
	return change === 'addTag' ? planAdd(property, tag) : planRemove(property, tag);
}

/** `before` with `tag` added, or with every spelling of it gone. */
export function expectedListTags(before: readonly string[], change: TagChange, tag: string): string[] {
	if (change === 'removeTag') return before.filter((have) => !sameTag(have, tag));
	return before.some((have) => sameTag(have, tag)) ? [...before] : [...before, tag];
}

/**
 * The RunEdit kind for `edit`, by the change in its line count: 'insert' for more lines, 'delete' for
 * fewer, 'change' for the same. The edit is above every item, so only the shift matters, and
 * followRange loses a range under a 'change' whose line count differs.
 */
export function listTagsEditKind(edit: MarkerEdit): 'insert' | 'delete' | 'change' {
	if (edit.insert.length > edit.deleteCount) return 'insert';
	return edit.insert.length < edit.deleteCount ? 'delete' : 'change';
}

function planAdd(property: TagsProperty, tag: string): MarkerEdit {
	if (property.form === 'block') {
		const last = property.itemLines.length - 1;
		const indent = property.indents[last] ?? '  ';
		const after = (property.itemLines[last] ?? property.keyLine) + 1;
		return { start: after, deleteCount: 0, insert: [`${indent}- ${tag}`] };
	}
	const raws = [...property.entries.map((entry) => entry.raw), tag];
	return { start: property.keyLine, deleteCount: 1, insert: [`${property.prefix} [${raws.join(', ')}]`] };
}

function planRemove(property: TagsProperty, tag: string): MarkerEdit {
	const kept = property.entries.filter((entry) => !sameTag(entry.tag, tag));
	if (property.form === 'block') return planRemoveBlock(property, tag, kept.length === 0);
	if (kept.length === 0) return { start: property.keyLine, deleteCount: 1, insert: [] };
	return { start: property.keyLine, deleteCount: 1, insert: [`${property.prefix} [${kept.map((entry) => entry.raw).join(', ')}]`] };
}

function planRemoveBlock(property: Extract<TagsProperty, { form: 'block' }>, tag: string, isEmptied: boolean): MarkerEdit {
	const { itemLines, entries, texts } = property;
	if (isEmptied) return { start: property.keyLine, deleteCount: (itemLines[itemLines.length - 1] as number) - property.keyLine + 1, insert: [] };
	const matches = entries.flatMap((entry, i) => (sameTag(entry.tag, tag) ? [i] : []));
	const first = matches[0] as number;
	const last = matches[matches.length - 1] as number;
	// The lines between the first and last match come back as they were, in the same single edit.
	const between = entries.slice(first, last + 1).flatMap((entry, i) => (sameTag(entry.tag, tag) ? [] : [texts[first + i] as string]));
	return { start: itemLines[first] as number, deleteCount: (itemLines[last] as number) - (itemLines[first] as number) + 1, insert: between };
}

// null: no `tags` key.
function readTagsProperty(lines: string[], closingLine: number): TagsProperty | 'unreadable' | null {
	const keys: number[] = [];
	for (let i = 1; i < closingLine; i++) if (TAGS_KEY_LINE.test(lines[i] as string)) keys.push(i);
	if (keys.length === 0) return null;
	if (keys.length > 1) return 'unreadable';
	const keyLine = keys[0] as number;
	const [, prefix = '', value = ''] = TAGS_KEY_LINE.exec(lines[keyLine] as string) ?? [];
	const next = keyLine + 1 < closingLine ? (lines[keyLine + 1] as string) : '';
	if (value.trim() === '') return readBlock(lines, keyLine, closingLine);
	if (/^[ \t]/.test(next) || COMMENT.test(value.replace(QUOTED, ''))) return 'unreadable';
	const trimmed = value.trim();
	if (!trimmed.startsWith('[')) {
		const entry = readEntry(trimmed);
		return entry ? { form: 'single', keyLine, prefix, entries: [entry] } : 'unreadable';
	}
	if (!trimmed.endsWith(']')) return 'unreadable';
	const inside = trimmed.slice(1, -1);
	const entries = inside.trim() === '' ? [] : inside.split(',').map(readEntry);
	return entries.every((entry) => entry !== null) ? { form: 'flow', keyLine, prefix, entries } : 'unreadable';
}

function readBlock(lines: string[], keyLine: number, closingLine: number): TagsProperty | 'unreadable' {
	const itemLines: number[] = [];
	const indents: string[] = [];
	const texts: string[] = [];
	const entries: Entry[] = [];
	for (let i = keyLine + 1; i < closingLine; i++) {
		const text = lines[i] as string;
		if (/^\S/.test(text) && !text.startsWith('- ')) break;
		const item = BLOCK_ITEM.exec(text);
		if (!item || COMMENT.test(text.replace(QUOTED, ''))) return 'unreadable';
		const entry = readEntry(item[2] as string);
		if (!entry || item[1] !== (indents[0] ?? item[1])) return 'unreadable';
		itemLines.push(i);
		texts.push(text);
		indents.push(item[1] as string);
		entries.push(entry);
	}
	return { form: 'block', keyLine, itemLines, indents, texts, entries };
}

// One scalar: plain, "double" or 'single' quoted. null when it is anything else, or can't be one tag.
function readEntry(scalar: string): Entry | null {
	const raw = scalar.trim();
	if (raw === '' || NOT_PLAIN_START.test(raw)) return null;
	const quote = raw.charAt(0);
	let body = raw;
	if (quote === '"' || quote === "'") {
		body = raw.slice(1, -1);
		if (raw.length < 2 || !raw.endsWith(quote) || body.includes(quote) || body.includes('\\')) return null;
	} else if (/:(\s|$)/.test(raw) || isYamlNonString(raw)) {
		return null;
	}
	const tag = body.startsWith('#') ? body.slice(1) : body;
	return tag.includes(',') || tag === '' ? null : { raw, tag };
}

// What YAML's core schema reads, unquoted, as a null, a boolean or a number, not as a string.
function isYamlNonString(plain: string): boolean {
	return /^(~|null|true|false|[-+]?(\d[\d_]*\.?\d*|\.\d+)([eE][-+]?\d+)?|0x[\da-f]+|0o[0-7]+|[-+]?\.(inf|nan))$/i.test(plain);
}
