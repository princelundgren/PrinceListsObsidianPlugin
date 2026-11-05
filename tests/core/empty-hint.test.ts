import { describe, expect, it } from 'vitest';
import { emptyHint } from '../../src/core/empty-hint';

describe('emptyHint', () => {
	it.each([
		['Cmd+Enter', true, 'Press Cmd+Enter or + to add an item'],
		['Cmd+Enter', false, 'Press Cmd+Enter to add an item'],
		['Ctrl+Enter', true, 'Press Ctrl+Enter or + to add an item'],
		[null, true, 'Tap + to add an item'],
		[null, false, 'Press Enter in the title to add an item'],
	])('with the add key %s and a "+" shown: %s, says "%s"', (addKeyName, showsPlus, hint) => {
		expect(emptyHint(addKeyName, showsPlus)).toBe(hint);
	});
});
