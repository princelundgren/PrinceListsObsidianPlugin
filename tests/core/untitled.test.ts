import { expect, test } from 'vitest';
import { nextUntitledName } from '../../src/core/untitled';

test('starts with the plain name', () => {
	expect(nextUntitledName(new Set())).toBe('Untitled list');
});

test('numbers the name when it is taken', () => {
	expect(nextUntitledName(new Set(['Untitled list.md']))).toBe('Untitled list 1');
	expect(nextUntitledName(new Set(['Untitled list.md', 'Untitled list 1.md']))).toBe(
		'Untitled list 2',
	);
});

test('takes the first free number', () => {
	expect(nextUntitledName(new Set(['Untitled list.md', 'Untitled list 2.md']))).toBe(
		'Untitled list 1',
	);
});

test('ignores other files and folders with the name', () => {
	expect(nextUntitledName(new Set(['Untitled list', 'Untitled list.txt']))).toBe('Untitled list');
});

test('treats names as case-insensitive, as macOS and iOS disks are', () => {
	expect(nextUntitledName(new Set(['untitled list.md']))).toBe('Untitled list 1');
});
