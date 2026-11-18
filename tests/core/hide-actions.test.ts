import { expect, test } from 'vitest';
import { whenHidden } from '../../src/core/hide-actions';

// Stands in for Obsidian's Menu, whose onHide keeps only the last callback it was given.
function fakeMenu() {
	const menu = { callback: null as (() => void) | null, sets: 0 };
	const setHideCallback = (callback: () => void) => {
		menu.callback = callback;
		menu.sets++;
	};
	return { menu, setHideCallback, hide: () => menu.callback?.() };
}

test('runs every action registered for one menu, in order, when it hides', () => {
	const { menu, setHideCallback, hide } = fakeMenu();
	const ran: string[] = [];
	whenHidden(menu, setHideCallback, () => ran.push('untrack'));
	whenHidden(menu, setHideCallback, () => ran.push('unmark'));
	hide();
	expect(ran).toEqual(['untrack', 'unmark']);
	expect(menu.sets).toBe(1);
});

test('keeps each menu’s actions apart', () => {
	const first = fakeMenu();
	const second = fakeMenu();
	const ran: string[] = [];
	whenHidden(first.menu, first.setHideCallback, () => ran.push('first'));
	whenHidden(second.menu, second.setHideCallback, () => ran.push('second'));
	second.hide();
	expect(ran).toEqual(['second']);
});

test('runs an action registered after the menu hid at once', () => {
	const { menu, setHideCallback, hide } = fakeMenu();
	const ran: string[] = [];
	whenHidden(menu, setHideCallback, () => ran.push('untrack'));
	hide();
	whenHidden(menu, setHideCallback, () => ran.push('open'));
	expect(ran).toEqual(['untrack', 'open']);
});
