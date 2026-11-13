import { describe, expect, test } from 'vitest';
import { rowTexts, sameRowTexts } from '../../src/core/row-texts';

const TEXT = '---\nprincelists: true\n---\n- [ ] oats #pantry\n- [ ] rice\r\n- [ ] milk';

describe('rowTexts', () => {
	test("reads each row's line without its ending", () => {
		expect(rowTexts(TEXT, [3, 4, 5])).toEqual([
			{ line: 3, text: '- [ ] oats #pantry' },
			{ line: 4, text: '- [ ] rice' },
			{ line: 5, text: '- [ ] milk' },
		]);
	});
});

describe('sameRowTexts', () => {
	const opened = rowTexts(TEXT, [3, 4]);

	test('holds for the same rows with the same text', () => {
		expect(sameRowTexts(opened, rowTexts(TEXT, [3, 4]))).toBe(true);
	});

	test("fails once a row's text changes, as an undo can leave the rows in place", () => {
		const undone = TEXT.replace('oats #pantry', 'oats');
		expect(sameRowTexts(opened, rowTexts(undone, [3, 4]))).toBe(false);
	});

	test('fails for other rows, or another number of them', () => {
		expect(sameRowTexts(opened, rowTexts(TEXT, [3, 5]))).toBe(false);
		expect(sameRowTexts(opened, rowTexts(TEXT, [3]))).toBe(false);
		expect(sameRowTexts(opened, rowTexts(TEXT, [3, 4, 5]))).toBe(false);
	});
});
