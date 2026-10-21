import { expect, test } from 'vitest';
import { isMarkerValue, lineAfterFrontmatter, opensWithFrontmatter } from '../../src/core/frontmatter';

test('isMarkerValue accepts only the YAML boolean true', () => {
	expect(isMarkerValue({ princelists: true })).toBe(true);
	for (const yaml of [{ princelists: 'true' }, { princelists: 1 }, { princelists: false }, null, undefined, 'princelists: true', {}]) {
		expect(isMarkerValue(yaml)).toBe(false);
	}
});

test('opensWithFrontmatter accepts contents that start right after a --- at offset 0', () => {
	expect(opensWithFrontmatter('---\nprincelists: true\n---\n', 4)).toBe(true);
	expect(opensWithFrontmatter('---\r\nprincelists: true\r\n---\r\n', 5)).toBe(true);
});

test('opensWithFrontmatter refuses frontmatter that is not at offset 0', () => {
	expect(opensWithFrontmatter(' ---\nprincelists: true\n---\n', 5)).toBe(false);
	expect(opensWithFrontmatter('\uFEFF---\nprincelists: true\n---\n', 5)).toBe(false);
	expect(opensWithFrontmatter('\n---\nprincelists: true\n---\n', 5)).toBe(false);
	expect(opensWithFrontmatter('----\nprincelists: true\n---\n', 5)).toBe(false);
	expect(opensWithFrontmatter('---\nprincelists: true\n---\n', 3)).toBe(false);
	expect(opensWithFrontmatter('Note', 0)).toBe(false);
});

test('lineAfterFrontmatter is the line after the closing ---, on either side of its break', () => {
	for (const text of ['---\nprincelists: true\n---\nNote', '---\r\nprincelists: true\r\n---\r\nNote']) {
		const closingEnd = text.lastIndexOf('---') + 3;
		for (let contentStart = closingEnd; contentStart <= text.indexOf('Note'); contentStart++) {
			expect(lineAfterFrontmatter(text, contentStart)).toBe(3);
		}
	}
});

test('lineAfterFrontmatter is the line count when the file is only frontmatter', () => {
	for (const text of ['---\nprincelists: true\n---', '---\nprincelists: true\n---\n', '---\r\nprincelists: true\r\n---\r\n']) {
		const closingEnd = text.lastIndexOf('---') + 3;
		for (let contentStart = closingEnd; contentStart <= text.length; contentStart++) {
			expect(lineAfterFrontmatter(text, contentStart)).toBe(3);
		}
	}
});
