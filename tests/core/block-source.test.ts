import { describe, expect, test } from 'vitest';
import { blockLink } from '../../src/core/block-source';

describe('blockLink', () => {
	test.each([
		['[[Groceries]]', 'Groceries'],
		['\n  [[Groceries]]  \n', 'Groceries'],
		['[[Groceries|Shop]]', 'Groceries'],
		['[[Lists/Groceries]]', 'Lists/Groceries'],
	])('reads the link from %j', (source, link) => {
		expect(blockLink(source)).toBe(link);
	});

	test.each(['', 'Groceries', '[[A]]\n[[B]]', '[[A]] and more'])('gives null for %j', (source) => {
		expect(blockLink(source)).toBeNull();
	});
});
