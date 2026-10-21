import { describe, expect, test } from 'vitest';
import { UnsafeEditError } from '../../src/core/edit-check';
import { deleteHeading, insertHeading, setHeadingText } from '../../src/core/edit-headings';
import { UnsafeEditError as ItemsUnsafeEditError } from '../../src/core/edit-items';
import { joinLines, type Line } from '../../src/core/lines';
import { isBlank } from '../../src/core/parse';
import {
	FIXTURES,
	JOINING_CASES,
	REFUSED_CASES,
	blockAt,
	crlf,
	expectLinesAfterKept,
	expectLinesBeforeKept,
	expectRestKept,
	list,
	readFixture,
} from './edit-helpers';

// Cases where deleting a heading leaves the text below it next to a block that would take it in, or
// where the heading's own lines need context to tell what they parse as.
const HEADING_CASES = {
	paragraphsAround: 'Text\n## H\nMore\n',
	lazyBelow: '- [ ] a\n## H\nText\n',
	setextBelow: 'Note\n## H\n---\n',
	indentedBelow: '- [ ] a\n## H\n  more\n',
	setextWithDefinition: '[r]: /u\nKitchen\n---\n- [ ] a\n',
	setextAfterItem: '- [ ] a\n\nOld\n===\n- [ ] b\n',
	multiLineSetext: 'Old\nline two\n===\n- [ ] a\n',
	closingSequence: '## Old ##\n- [ ] a\n',
	emptyHeading: '- [ ] a\n##\n- [ ] b\n',
	unclosedFence: '## G\n- [ ] a\n\n```\ncode\n',
	gapsAround: '- [ ] a\n\n## H\n\n- [ ] b\n',
};

const ALL_CASES: Record<string, string> = {
	...HEADING_CASES,
	...JOINING_CASES,
	...REFUSED_CASES,
	...Object.fromEntries(FIXTURES.map((name) => [name, readFixture(name)])),
};

const refusedOrRun = <T>(edit: () => T): T | 'refused' => {
	try {
		return edit();
	} catch (error) {
		if (error instanceof UnsafeEditError) return 'refused';
		throw error;
	}
};

test('UnsafeEditError is one class, whether imported with the item edits or the check', () => {
	expect(ItemsUnsafeEditError).toBe(UnsafeEditError);
});

describe('insertHeading', () => {
	test.each([
		['- [ ] a\n- [ ] b\n', { afterItem: 0 }, 'H', '- [ ] a\n## H\n- [ ] b\n', 1],
		['## G\n- [ ] a\n## K\n- [ ] b\n', { afterSection: 1 }, 'H', '## G\n- [ ] a\n## H\n## K\n- [ ] b\n', 2],
		['- [ ] a\n- [ ] b\n', { afterItem: 0 }, '', '- [ ] a\n##\n- [ ] b\n', 1],
		// Beyond the table: the file's line endings and its missing final newline stay.
		[crlf('- [ ] a\n- [ ] b\n'), { afterItem: 0 }, 'H', crlf('- [ ] a\n## H\n- [ ] b\n'), 1],
		['- [ ] a', { afterItem: 0 }, 'H', '- [ ] a\n## H', 1],
		// A section's end comes after its hidden rows and untouched content, before the next heading.
		['## G\n- [ ] a\n- [x] b\n\nText\n\n## K\n', { afterSection: 1 }, 'H', '## G\n- [ ] a\n- [x] b\n\nText\n## H\n\n## K\n', 5],
	] as const)('%j at %j with %j', (text, at, heading, expected, headingLine) => {
		const { lines, model, item, section } = list(text);
		const where = 'afterItem' in at ? { afterItem: item(at.afterItem) } : { afterSection: section(at.afterSection) };
		const result = insertHeading(lines, model, where, heading);
		expect(joinLines(result.lines)).toBe(expected);
		expect(result.headingLine).toBe(headingLine);
	});
	test('refuses an insert where the heading would join the block above, even after an empty line', () => {
		for (const [text, n] of [
			[REFUSED_CASES.divInEmptySection, 1],
			[HEADING_CASES.unclosedFence, 1],
			[readFixture('unclosed.md'), 0],
		] as const) {
			const { lines, model, section } = list(text);
			expect(() => insertHeading(lines, model, { afterSection: section(n) }, 'H'), JSON.stringify(text)).toThrow(UnsafeEditError);
			expect(joinLines(lines)).toBe(text);
		}
	});
	test('refuses a text with a line break', () => {
		const { lines, model, item } = list('- [ ] a\n');
		for (const text of ['a\nb', 'a\rb', 'H\n']) {
			expect(() => insertHeading(lines, model, { afterItem: item(0) }, text)).toThrow('A heading must be a single line');
		}
	});
	test('leaves every item, heading and untouched block as it parsed, or is refused', () => {
		const refused: string[] = [];
		for (const [name, text] of Object.entries(ALL_CASES)) {
			const { lines, model, items } = list(text);
			const places = [
				...items.map((it, n) => [`after item ${n}`, { afterItem: it }] as const),
				...model.sections.map((s, n) => [`after section ${n}`, { afterSection: s }] as const),
			];
			for (const [place, at] of places) {
				for (const heading of ['H', '']) {
					const result = refusedOrRun(() => insertHeading(lines, model, at, heading));
					if (result === 'refused') {
						refused.push(`${name} ${place} ${JSON.stringify(heading)}`);
						continue;
					}
					const after = joinLines(result.lines);
					const written = heading === '' ? '##' : `## ${heading}`;
					expectRestKept(text, after, { added: [`heading:${written}`] });
					expectLinesBeforeKept(lines, result.lines, result.headingLine);
					expectLinesAfterKept(lines, result.lines, result.headingLine);
					expect(blockAt(after, result.headingLine)?.block).toBe(`heading:${written}`);
					expect(list(after).model.sections.some((s) => s.headingLine === result.headingLine)).toBe(true);
				}
			}
		}
		expect(refused).toEqual([
			// The check reads a setext heading's source from its paragraph's first line, the definition,
			// so a heading between the two reads as a change. insertItem refuses the same place.
			'setextWithDefinition after section 0 "H"',
			'setextWithDefinition after section 0 ""',
			'unclosedFence after section 1 "H"',
			'unclosedFence after section 1 ""',
			'divInEmptySection after section 1 "H"',
			'divInEmptySection after section 1 ""',
			'unclosed.md after section 0 "H"',
			'unclosed.md after section 0 ""',
		]);
	});
});

describe('deleteHeading', () => {
	test.each([
		['## G\n- [ ] a\n## H\n- [ ] b\n', 2, '## G\n- [ ] a\n- [ ] b\n'],
		['- [ ] a\n##\n- [ ] b\n', 1, '- [ ] a\n- [ ] b\n'],
		// Beyond the table: text that would join the block above gets an empty line in the heading's
		// place, as more of a paragraph, a lazy line or a setext heading's text.
		[HEADING_CASES.paragraphsAround, 1, 'Text\n\nMore\n'],
		[HEADING_CASES.lazyBelow, 1, '- [ ] a\n\nText\n'],
		[HEADING_CASES.setextBelow, 1, 'Note\n\n---\n'],
		[crlf(HEADING_CASES.paragraphsAround), 1, crlf('Text\n\nMore\n')],
		// A setext heading goes with its underline. Link reference definitions that open its paragraph
		// are untouched content and stay.
		['Note\n\nKitchen\n---\n- [ ] a\n', 1, 'Note\n\n- [ ] a\n'],
		[HEADING_CASES.multiLineSetext, 1, '- [ ] a\n'],
		[HEADING_CASES.setextWithDefinition, 1, '[r]: /u\n- [ ] a\n'],
		['- [ ] a\n## H', 1, '- [ ] a'],
		// Between two gaps, the gap after the heading goes too, as for deleteItem.
		[HEADING_CASES.gapsAround, 1, '- [ ] a\n\n- [ ] b\n'],
		['- [ ] a\n\n## H\n\n\n- [ ] b\n', 1, '- [ ] a\n\n- [ ] b\n'],
		['- [ ] a\n\n## H\n- [ ] b\n', 1, '- [ ] a\n\n- [ ] b\n'],
		['- [ ] a\n## H\n\n- [ ] b\n', 1, '- [ ] a\n\n- [ ] b\n'],
		['Note\n\nKitchen\n---\n\n- [ ] a\n', 1, 'Note\n\n- [ ] a\n'],
	])('%j without section %i', (text, n, expected) => {
		const { lines, model, section } = list(text);
		expect(joinLines(deleteHeading(lines, model, section(n)))).toBe(expected);
	});
	test('refuses a delete that leaves text the item above takes in, even after an empty line', () => {
		const { lines, model, section } = list(HEADING_CASES.indentedBelow);
		expect(() => deleteHeading(lines, model, section(1))).toThrow(UnsafeEditError);
		expect(joinLines(lines)).toBe(HEADING_CASES.indentedBelow);
	});
	test('refuses the top section, which has no heading', () => {
		const { lines, model, section } = list('- [ ] a\n## H\n');
		expect(() => deleteHeading(lines, model, section(0))).toThrow('The section has no heading here; parse the lines again');
	});
	test('leaves every item, heading and untouched block as it parsed, or is refused', () => {
		const refused: string[] = [];
		for (const [name, text] of Object.entries(ALL_CASES)) {
			const { lines, model } = list(text);
			model.sections.forEach((section, n) => {
				if (section.headingLine === null) return;
				const result = refusedOrRun(() => deleteHeading(lines, model, section));
				if (result === 'refused') {
					refused.push(`${name} section ${n}`);
					return;
				}
				const heading = blockAt(text, section.headingLine) as { block: string; end: number };
				expectRestKept(text, joinLines(result), { removed: [heading.block] });
				expectLinesBeforeKept(lines, result, section.headingLine);
				// The run takes the gap after the heading when a gap comes before it.
				let runEnd = heading.end;
				if (isBlank(lines[section.headingLine - 1]?.text ?? '-')) while (isBlank(lines[runEnd]?.text ?? '-')) runEnd++;
				expectLinesAfterKept(lines, result, runEnd);
			});
		}
		expect(refused).toEqual(['indentedBelow section 1']);
	});
});

describe('setHeadingText', () => {
	test.each([
		['## Kitchen\n- [ ] a\n', 'Pantry', '## Pantry\n- [ ] a\n'],
		['### Old\n- [ ] a\n', 'New', '### New\n- [ ] a\n'],
		['## Kitchen\r\n- [ ] a\r\n', 'Pantry', '## Pantry\r\n- [ ] a\r\n'],
		['## Old ##\n- [ ] a\n', 'New', '## New ##\n- [ ] a\n'],
		['Old\n===\n- [ ] a\n', 'New', 'New\n===\n- [ ] a\n'],
		['  ## Old\n- [ ] a\n', 'New', '  ## New\n- [ ] a\n'],
		['Old\n===\n- [ ] a\n', '- [ ] New', null],
		['## Old\n- [ ] a\n', 'C #', null],
		['Old\nline two\n===\n- [ ] a\n', 'New', 'New\n===\n- [ ] a\n'],
		['- [ ] a\n##\n- [ ] b\n', 'H', '- [ ] a\n## H\n- [ ] b\n'],
		// Beyond the table: what lies around the content stays as written.
		['##\tOld  \n', 'New', '##\tNew  \n'],
		['## #\n', 'New', '## New #\n'],
		['# Old #\n', 'C #', '# C # #\n'],
		['Old\n---\n', 'New', 'New\n---\n'],
		['Old\r\nline two\r\n===\r\n', 'New', 'New\r\n===\r\n'],
		['## Old', 'New', '## New'],
		['## Old\r\n- [ ] a\n- [ ] b\n', 'New', '## New\r\n- [ ] a\n- [ ] b\n'],
		// Lines that only look like ATX headings: no space after the # run, or indented 4 spaces after
		// a definition, where the paragraph carries on.
		['#hashtag\n===\n', 'New', 'New\n===\n'],
		['[r]: /u\n    # Old\n===\n', 'New', '[r]: /u\nNew\n===\n'],
		[HEADING_CASES.setextWithDefinition, 'New', '[r]: /u\nNew\n---\n- [ ] a\n'],
		// Text the heading wouldn't hold exactly: spaces it trims, a closing sequence, a line break.
		['## Old\n', ' New', null],
		['## Old\n', 'New ', null],
		['## Old\n', '#', null],
		['## Old\n', 'a\nb', null],
		['Old\n===\n', 'a\nb', null],
		// Text that turns a setext heading's line into something else.
		['Old\n===\n', '', null],
		['Old\n===\n', '# New', null],
		['Old\n===\n', '[s]: /v', null],
		['Old\n===\n', '```', null],
		['Old\n===\n', '%%', null],
		// Text the block above takes in: indented to the item's content column, it joins the item.
		[HEADING_CASES.setextAfterItem, '  New', null],
		[HEADING_CASES.setextAfterItem, 'New', '- [ ] a\n\nNew\n===\n- [ ] b\n'],
	])('%j with %j', (text, heading, expected) => {
		const { lines, model, section } = list(text);
		const result = setHeadingText(lines, model, section(1), heading);
		expect(result === null ? null : joinLines(result)).toBe(expected);
		if (result === null) expect(joinLines(lines)).toBe(text);
	});
	test('refuses the top section, which has no heading, and a section from other lines', () => {
		const { lines, model, section } = list('- [ ] a\n## H\n');
		expect(() => setHeadingText(lines, model, section(0), 'New')).toThrow('The section has no heading here; parse the lines again');
		const other = list('## H\n- [ ] a\n');
		expect(() => setHeadingText(lines, model, other.section(1), 'New')).toThrow('The section has no heading here; parse the lines again');
		expect(() => deleteHeading(lines, model, other.section(1))).toThrow('The section has no heading here; parse the lines again');
	});
	test('setting a one-line heading\'s current text leaves the file byte-identical', () => {
		for (const text of [
			'## Kitchen\n',
			'  ### Old ###  \r\n- [ ] a\r\n',
			'#\tTab\n',
			'## a ## b\n',
			'## C#\n',
			'- [ ] a\n##\n- [ ] b\n',
			'## \n',
			'## #\n',
			'##   ##   \n',
			'Old\n===\n',
			HEADING_CASES.setextWithDefinition,
			readFixture('example.md'),
			JOINING_CASES.setextHeadingTop2,
		]) {
			const { lines, model } = list(text);
			for (const section of model.sections.slice(1)) {
				const own = (lines[section.headingLine as number] as Line).text;
				const content = /^ {0,3}#/.test(own) ? atxContent(own) : own;
				expect(joinLines(setHeadingText(lines, model, section, content) as Line[]), JSON.stringify(own)).toBe(text);
			}
		}
	});
	test('keeps every other item, heading and untouched block as it parsed, or returns null', () => {
		for (const text of Object.values(ALL_CASES)) {
			const { lines, model } = list(text);
			for (const section of model.sections.slice(1)) {
				const at = section.headingLine as number;
				for (const heading of ['New', '- [ ] New', 'C #', '  New', '> q', '<div>', '[s]: /v']) {
					const result = setHeadingText(lines, model, section, heading);
					if (result === null) continue;
					const after = joinLines(result);
					const old = blockAt(text, at) as { block: string; end: number };
					const added = blockAt(after, at)?.block as string;
					expect(added.startsWith('heading:')).toBe(true);
					expect(list(after).model.sections.some((s) => s.headingLine === at)).toBe(true);
					expectRestKept(text, after, { removed: [old.block], added: [added] });
					expectLinesBeforeKept(lines, result, at);
					expectLinesAfterKept(lines, result, old.end);
				}
			}
		}
	});
});

// An ATX heading's raw content, as CommonMark's spec defines it: commonmark.js's own patterns.
function atxContent(text: string): string {
	return text
		.replace(/^ {0,3}#{1,6}(?:[ \t]+|$)/, '')
		.replace(/^[ \t]*#+[ \t]*$/, '')
		.replace(/[ \t]+#+[ \t]*$/, '')
		.replace(/[ \t]+$/, '');
}
