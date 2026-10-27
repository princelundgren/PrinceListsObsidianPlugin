import { expect, test } from 'vitest';
import { applyMarkerEdit, type FrontmatterShape, planMarker } from '../../src/core/marker-edit';

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
])('planMarker refuses a princelists value over several lines in %j', (text) => {
	expect(turned(text, fm(3))).toEqual({ refused: 'multiline-value' });
});
