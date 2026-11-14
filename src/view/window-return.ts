import type { Component } from 'obsidian';

// Calls `bringBack` when the window `el` is in gets focus, or its page becomes visible again, as when
// the app returns to the screen (repeating items' design, "Coming back"). The listeners follow `el`
// into a popout window and go with `component`; each answers only while `el` is in its window.
export function onWindowReturn(component: Component, el: HTMLElement, bringBack: () => void): void {
	const listened = new Set<Window>();
	const listen = (win: Window) => {
		if (listened.has(win)) return;
		listened.add(win);
		component.registerDomEvent(win, 'focus', () => {
			if (el.win === win) bringBack();
		});
		component.registerDomEvent(win.document, 'visibilitychange', () => {
			if (el.win === win && win.document.visibilityState === 'visible') bringBack();
		});
	};
	listen(el.win);
	component.register(el.onWindowMigrated(listen));
}
