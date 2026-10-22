import { describe, expect, test } from 'vitest';
import { nameTaken } from '../../src/core/file-name';

describe('nameTaken', () => {
	test('is true for a name another file in the folder has, in any case', () => {
		expect(nameTaken(['Groceries.md', 'Shopping.md'], 'Shopping.md', 'groceries.md')).toBe(true);
		expect(nameTaken(['Groceries.md', 'Shopping.md'], 'Shopping.md', 'Groceries.md')).toBe(true);
	});

	test("is false for the file's own name in another case, so that rename still works", () => {
		expect(nameTaken(['groceries.md', 'Shopping.md'], 'groceries.md', 'Groceries.md')).toBe(false);
	});

	test('is false for a name no file has', () => {
		expect(nameTaken(['Groceries.md', 'Shopping.md'], 'Shopping.md', 'Hardware.md')).toBe(false);
	});
});
