import { describe, expect, it } from 'vitest';
import type { TagChange } from '../../src/core/group-menu';
import { headingEndTags, planHeadingTag } from '../../src/core/heading-tags';

const list = (body: string) => '---\nprincelists: true\n---\n' + body;

describe('headingEndTags', () => {
	it.each([
		['Office #work', ['work']],
		['Office #work #Home', ['work', 'Home']],
		['Office #work #Work', ['work']],
		['The #work trip', []],
		['#work', ['work']],
		['Use `#tag`', []],
		['Office', []],
	])('%s', (text, tags) => expect(headingEndTags(text)).toEqual(tags));
});

// The heading is on line 3.
describe('planHeadingTag', () => {
	it.each<[string, TagChange, string, string]>([
		['## Office\n', 'addTag', 'work', '## Office #work\n'],
		['## Office ##\n', 'addTag', 'work', '## Office #work ##\n'],
		['##\n', 'addTag', 'work', '## #work\n'],
		['Office\n===\n', 'addTag', 'work', 'Office #work\n===\n'],
		['Office\nhours\n===\n', 'addTag', 'work', 'Office hours #work\n===\n'],
		['## Office #work #home\n', 'removeTag', 'work', '## Office #home\n'],
		['## Office #work #Work\n', 'removeTag', 'WORK', '## Office\n'],
	])('%j %s %s', (body, change, tag, after) => {
		const result = planHeadingTag(list(body), 3, 3, change, tag);
		expect(result).toMatchObject({ kind: 'write', next: list(after) });
	});
	it.each<[string, TagChange, string]>([
		['## Office #work\n', 'addTag', 'Work'],
		['## The #work trip\n', 'addTag', 'work'],
		['## The #work trip\n', 'removeTag', 'work'],
	])('%j %s %s changes nothing', (body, change, tag) => expect(planHeadingTag(list(body), 3, 3, change, tag)).toEqual({ kind: 'none' }));
	it('refuses to leave a heading with no text', () => {
		expect(planHeadingTag(list('## #work\n'), 3, 3, 'removeTag', 'work')).toEqual({ kind: 'refused' });
		expect(planHeadingTag(list('#work\n===\n'), 3, 3, 'removeTag', 'work')).toEqual({ kind: 'refused' });
	});
	it('is lost when the line is no heading', () => {
		expect(planHeadingTag(list('- [ ] call\n'), 3, 3, 'addTag', 'work')).toEqual({ kind: 'lost' });
	});
	it('keeps a CRLF line ending', () => {
		expect(planHeadingTag('---\r\nprincelists: true\r\n---\r\n## Office\r\n', 3, 3, 'addTag', 'work'))
			.toMatchObject({ next: '---\r\nprincelists: true\r\n---\r\n## Office #work\r\n' });
	});
});
