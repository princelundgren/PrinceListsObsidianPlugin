import { expect, test } from 'vitest';
import { NewListTracker, START_STEPS, stepTexts } from '../../src/core/getting-started';

test('a note made as a list is "Make a list"', () => {
	const tracker = new NewListTracker([]);
	tracker.created('Untitled list.md');
	expect(tracker.indexed('Untitled list.md', true)).toBe('make-list');
});

test('a note that was there before and becomes a list is "Turn a note into a list"', () => {
	const tracker = new NewListTracker([]);
	tracker.modified('Trip.md');
	expect(tracker.indexed('Trip.md', true)).toBe('turn-into-list');
});

test('a new note written to before it becomes a list is "Turn a note into a list"', () => {
	const tracker = new NewListTracker([]);
	tracker.created('Untitled.md');
	tracker.modified('Untitled.md');
	expect(tracker.indexed('Untitled.md', true)).toBe('turn-into-list');
});

test('a new note indexed as a plain note first is "Turn a note into a list" later', () => {
	const tracker = new NewListTracker([]);
	tracker.created('Untitled.md');
	expect(tracker.indexed('Untitled.md', false)).toBeNull();
	expect(tracker.indexed('Untitled.md', true)).toBe('turn-into-list');
});

test('a list that changes ticks nothing', () => {
	const tracker = new NewListTracker(['Groceries.md']);
	tracker.modified('Groceries.md');
	expect(tracker.indexed('Groceries.md', true)).toBeNull();
});

test('a list made once ticks nothing when it is indexed again', () => {
	const tracker = new NewListTracker([]);
	tracker.created('Untitled list.md');
	tracker.indexed('Untitled list.md', true);
	expect(tracker.indexed('Untitled list.md', true)).toBeNull();
});

test('a list turned back into a note and into a list again is "Turn a note into a list"', () => {
	const tracker = new NewListTracker(['Groceries.md']);
	expect(tracker.indexed('Groceries.md', false)).toBeNull();
	expect(tracker.indexed('Groceries.md', true)).toBe('turn-into-list');
});

test('a renamed list is still a list', () => {
	const tracker = new NewListTracker(['Groceries.md']);
	tracker.renamed('Groceries.md', 'Shopping.md');
	expect(tracker.indexed('Shopping.md', true)).toBeNull();
});

test('a new list renamed before it is indexed is still "Make a list"', () => {
	const tracker = new NewListTracker([]);
	tracker.created('Untitled list.md');
	tracker.renamed('Untitled list.md', 'Groceries.md');
	expect(tracker.indexed('Groceries.md', true)).toBe('make-list');
});

test('a list deleted, then made again at the same path, is "Make a list"', () => {
	const tracker = new NewListTracker(['Untitled list.md']);
	tracker.deleted('Untitled list.md');
	tracker.created('Untitled list.md');
	expect(tracker.indexed('Untitled list.md', true)).toBe('make-list');
});

test('mobile is told to long-press, never to right-click', () => {
	const texts = stepTexts(true);
	for (const step of START_STEPS) expect(texts[step].how).not.toMatch(/right-click/i);
	expect(texts['make-list'].how).toMatch(/long-press a folder/i);
	expect(texts['turn-into-list'].how).toMatch(/long-press a note/i);
});

test('a computer is told to right-click', () => {
	const texts = stepTexts(false);
	expect(texts['make-list'].how).toMatch(/right-click a folder/i);
	expect(texts['turn-into-list'].how).toMatch(/right-click a note/i);
});
