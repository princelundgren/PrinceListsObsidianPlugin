import { expect, test } from 'vitest';
import { expectedListTags, type ListTagsRefusal, listTagsEditKind, planListTags } from '../../src/core/list-tags-edit';
import { applyMarkerEdit, type FrontmatterShape, type MarkerEdit } from '../../src/core/marker-edit';

const fm = (lines: string) => `---\nprincelists: true\n${lines}---\n- [ ] a\n`;
const shape = (text: string): FrontmatterShape => ({ closingLine: text.split(/\r?\n/).indexOf('---', 1), isMapping: true });

function plan(text: string, change: 'addTag' | 'removeTag', tag: string): MarkerEdit | ListTagsRefusal | null {
	return planListTags(text, shape(text), change, tag);
}

function applied(text: string, change: 'addTag' | 'removeTag', tag: string): { text: string; kind: string } | null {
	const edit = plan(text, change, tag);
	if (edit === null) return null;
	if ('refused' in edit) throw new Error(edit.refused);
	return { text: applyMarkerEdit(text, edit), kind: listTagsEditKind(edit) };
}

test.each([
	['', 'addTag', 'home', 'tags:\n  - home\n', 'insert'],
	['tags: work\n', 'addTag', 'home', 'tags: [work, home]\n', 'change'],
	['Tags: work\n', 'addTag', 'home', 'Tags: [work, home]\n', 'change'],
	['tags: [work]\n', 'addTag', 'home', 'tags: [work, home]\n', 'change'],
	['tags: []\n', 'addTag', 'home', 'tags: [home]\n', 'change'],
	['tags:\n  - work\n', 'addTag', 'home', 'tags:\n  - work\n  - home\n', 'insert'],
	['tags:\n- work\n', 'addTag', 'home', 'tags:\n- work\n- home\n', 'insert'],
	['tags:\n', 'addTag', 'home', 'tags:\n  - home\n', 'insert'],
	['tags: [work home]\n', 'addTag', 'home', 'tags: [work home, home]\n', 'change'],
	['tags: [work, home]\n', 'removeTag', 'home', 'tags: [work]\n', 'change'],
	['tags: [work, Work, home]\n', 'removeTag', 'WORK', 'tags: [home]\n', 'change'],
	['tags:\n  - work\n  - home\n', 'removeTag', 'work', 'tags:\n  - home\n', 'delete'],
	['tags: work\n', 'removeTag', 'work', '', 'delete'],
	['tags: ["#work"]\n', 'removeTag', 'work', '', 'delete'],
	['tags:\n  - work\n', 'removeTag', 'work', '', 'delete'],
	['tags:\n  - work\n  - home\n  - Work\n', 'removeTag', 'WORK', 'tags:\n  - home\n', 'delete'],
	['tags:\n  - work\n  -  x \n  - Work\n', 'removeTag', 'work', 'tags:\n  -  x \n', 'delete'],
	['tags: ["true"]\n', 'addTag', 'home', 'tags: ["true", home]\n', 'change'],
] as const)('%j with %s %s becomes %j', (lines, change, tag, after, kind) => {
	expect(applied(fm(lines), change, tag)).toEqual({ text: fm(after), kind });
});

test.each([
	['tags: [work]\n', 'addTag', 'Work'],
	['tags: [work]\n', 'removeTag', 'home'],
	['', 'removeTag', 'home'],
] as const)('%j with %s %s plans nothing', (lines, change, tag) => {
	expect(applied(fm(lines), change, tag)).toBeNull();
});

test('a CRLF file keeps its line endings on new lines', () => {
	const text = fm('tags:\n  - work\n').replaceAll('\n', '\r\n');
	expect(applied(text, 'addTag', 'home')?.text).toBe(fm('tags:\n  - work\n  - home\n').replaceAll('\n', '\r\n'));
	expect(applied(fm('').replaceAll('\n', '\r\n'), 'addTag', 'home')?.text).toBe(fm('tags:\n  - home\n').replaceAll('\n', '\r\n'));
});

test('a property in the middle of the frontmatter leaves the lines after it alone', () => {
	const text = fm('tags:\n  - work\ntitle: A\n');
	expect(applied(text, 'addTag', 'home')?.text).toBe(fm('tags:\n  - work\n  - home\ntitle: A\n'));
	expect(applied(text, 'removeTag', 'work')?.text).toBe(fm('title: A\n'));
});

test('frontmatter that is no mapping, or none, is refused', () => {
	const text = fm('');
	expect(planListTags(text, { closingLine: 2, isMapping: false }, 'addTag', 'home')).toEqual({ refused: 'not-a-mapping' });
	expect(planListTags('- [ ] a\n', null, 'addTag', 'home')).toEqual({ refused: 'not-a-mapping' });
});

test.each([
	'tags: |\n  a\n',
	'tags: >\n  a\n',
	'tags: [a,\n  b]\n',
	'tags: &x [a]\n',
	'tags: *x\n',
	'tags: !!seq [a]\n',
	'tags: [a] # c\n',
	'tags: work # c\n',
	'tags:\n  # c\n  - a\n',
	'tags: a\nTags: b\n',
	'tags:\n  - a: b\n',
	'tags: {a: b}\n',
	'tags: [a, [b]]\n',
	'tags: ["a,b"]\n',
	'tags: work, home\n',
	'tags: ~\n',
	'tags: null\n',
	'tags: [a, true]\n',
	'tags:\n  - 123\n',
	'tags:\n  - work\n    - x\n',
	'tags:\n- a\n  - b\n',
])('a tags property written as %j is unreadable', (lines) => {
	expect(plan(fm(lines), 'addTag', 'home')).toEqual({ refused: 'unreadable' });
	expect(plan(fm(lines), 'removeTag', 'a')).toEqual({ refused: 'unreadable' });
});

test('expectedListTags adds the tag, or removes every spelling of it', () => {
	expect(expectedListTags(['work', 'Work', 'home'], 'removeTag', 'WORK')).toEqual(['home']);
	expect(expectedListTags(['work'], 'addTag', 'home')).toEqual(['work', 'home']);
});
