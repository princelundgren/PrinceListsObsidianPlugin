import type { Menu } from 'obsidian';
import { headingChoices } from '../core/group-edits';
import { contentStartLine } from '../obsidian/marker';
import type { PrinceListView } from './list-view';
import { atLine, onMenuHide } from './menu-anchor';

/**
 * Adds "Top of the list" and then the view's headings, in list order, to `menu`. Choosing one hands
 * its heading's line, or null for the top, to `onChoose`; the heading lines follow the view's edits
 * while the menu shows, and a heading that went shows a notice instead.
 */
export function addHeadingEntries(view: PrinceListView, menu: Menu, onChoose: (headingLine: number | null) => void): void {
	for (const { label, headingLine } of headingChoices(view.text, contentStartLine(view.text))) {
		if (headingLine === null) {
			menu.addItem((item) => item.setTitle(label).onClick(() => onChoose(null)));
			continue;
		}
		const anchor = view.editing.track(headingLine);
		onMenuHide(menu, () => view.editing.untrack(anchor));
		menu.addItem((item) => item.setTitle(label).onClick(atLine(anchor, onChoose)));
	}
}
