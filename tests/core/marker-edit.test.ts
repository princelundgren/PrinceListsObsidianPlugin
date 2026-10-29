import { expect, test } from 'vitest';
import { applyMarkerEdit, type FrontmatterShape, planMarker, planUnmark } from '../../src/core/marker-edit';

const fm = (closingLine: number): FrontmatterShape => ({ closingLine, isMapping: true });

function turned(text: string, frontmatter: FrontmatterShape | null): string | { refused: string } {
	const plan = planMarker(text, frontmatter);
	return 'refused' in plan ? plan : applyMarkerEdit(text, plan);
}

test.each([
	['---\ntitle: A\n---\nBody\n', fm(2), '---\ntitle: A\nprincelists: true\n---\nBody\n'],
	['---\nprincelists: false\ntags: [a]\n---\n', fm(3), '---\nprincelists: true\ntags: [a]\n---\n'],
	['---\n---\nBody\n', fm(1), '---\nprincelists: true\n---\nBody\n'],
	['Body\n- [ ] a\n', null, '---\nprincelists: true\n---\nBody\n- [ ] a\n'],
	['Body\r\n', null, '---\r\nprincelists: true\r\n---\r\nBody\r\n'],
	['---\r\nt: 1\r\n---\r\n', fm(2), '---\r\nt: 1\r\nprincelists: true\r\n---\r\n'],
	['Body', null, '---\nprincelists: true\n---\nBody'],
	['', null, '---\nprincelists: true\n---\n'],
	['---\nprincelists:\ntitle: A\n---\n', fm(3), '---\nprincelists: true\ntitle: A\n---\n'],
	['---\n"princelists": false\n---\n', fm(2), '---\nprincelists: true\n---\n'],
	["---\n'princelists': false\n---\n", fm(2), '---\nprincelists: true\n---\n'],
	['---\nprincelists : false\n---\n', fm(2), '---\nprincelists: true\n---\n'],
])('planMarker turns %j into a list', (text, frontmatter, expected) => {
	expect(turned(text, frontmatter)).toBe(expected);
});

test('planMarker refuses frontmatter that is not a mapping', () => {
	expect(turned('---\n- a\n---\n', { closingLine: 2, isMapping: false })).toEqual({ refused: 'not-a-mapping' });
});

test.each([
	'---\nprincelists:\n  - x\n---\n',
	'---\nprincelists: |\n  x\n---\n',
	'---\nprincelists: >-\n  x\n---\n',
	'---\nprincelists: |+\n  x\n---\n',
	'---\nprincelists:\n- x\n---\n',
	'---\nprincelists: [a,\n  b]\n---\n',
	'---\nprincelists: "a\n  b"\n---\n',
	'---\nprincelists: a\n  b\n---\n',
	'---\n"princelists": |\n  x\n---\n',
	'---\nprincelists : |\n  x\n---\n',
])('planMarker refuses a princelists value over several lines in %j', (text) => {
	expect(turned(text, fm(3))).toEqual({ refused: 'multiline-value' });
});

function unmarked(text: string, closingLine: number): string | { refused: string } {
	const plan = planUnmark(text, closingLine);
	return 'refused' in plan ? plan : applyMarkerEdit(text, plan);
}

test.each([
	['---\ntitle: A\nprincelists: true\n---\nBody\n', 3, '---\ntitle: A\n---\nBody\n'],
	['---\nprincelists: true\ntags: [a]\n---\n', 3, '---\ntags: [a]\n---\n'],
	['---\r\nt: 1\r\nprincelists: true\r\n---\r\n', 3, '---\r\nt: 1\r\n---\r\n'],
	['---\n"princelists" : true\nt: 1\n---\n', 3, '---\nt: 1\n---\n'],
])('planUnmark takes the marker out of %j', (text, closingLine, expected) => {
	expect(unmarked(text, closingLine)).toBe(expected);
});

test.each([
	['---\nprincelists: true\n---\nBody\n- [ ] a\n', 'Body\n- [ ] a\n'],
	['---\r\nprincelists: true\r\n---\r\nBody\r\n', 'Body\r\n'],
	['---\nprincelists: true\n---\nBody', 'Body'],
	['---\nprincelists: true\n---\n', ''],
])('planUnmark takes out frontmatter that held only the marker, as Turn into list wrote it, in %j', (text, expected) => {
	expect(unmarked(text, 2)).toBe(expected);
});

test('planUnmark gives back the note Turn into list started from', () => {
	for (const note of ['Body\n- [ ] a\n', '---\ntitle: A\n---\nBody\n', 'Body']) {
		const list = turned(note, note.startsWith('---') ? fm(2) : null) as string;
		const closingLine = list.split('\n').indexOf('---', 1);
		expect(unmarked(list, closingLine)).toBe(note);
	}
});

test('planUnmark refuses a marker it cannot find on a line of its own', () => {
	expect(unmarked('---\n{princelists: true}\n---\n', 2)).toEqual({ refused: 'not-found' });
});

test('planUnmark refuses a princelists value over several lines', () => {
	expect(unmarked('---\nprincelists:\n  true\n---\n', 3)).toEqual({ refused: 'multiline-value' });
});
