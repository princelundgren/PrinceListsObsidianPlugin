import { expect, test } from 'vitest';
import { labelWithKey, modKeyName } from '../../src/core/key-name';

test('names Cmd on macOS', () => {
	expect(modKeyName({ isMobile: false, isMacOS: true }, 'Enter')).toBe('Cmd+Enter');
});

test('names Ctrl on Windows and Linux', () => {
	expect(modKeyName({ isMobile: false, isMacOS: false }, 'Enter')).toBe('Ctrl+Enter');
});

test('names no key on mobile, an iPhone included', () => {
	expect(modKeyName({ isMobile: true, isMacOS: true }, 'Enter')).toBeNull();
	expect(modKeyName({ isMobile: true, isMacOS: false }, 'Enter')).toBeNull();
});

test('puts the key in parentheses after the label', () => {
	expect(labelWithKey('New item', 'Cmd+Enter')).toBe('New item (Cmd+Enter)');
});

test('leaves the label alone with no key', () => {
	expect(labelWithKey('New item', null)).toBe('New item');
});
