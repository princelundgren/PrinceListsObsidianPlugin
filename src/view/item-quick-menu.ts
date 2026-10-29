import type { Menu } from 'obsidian';
import { timelessItemRow } from '../core/display';
import type { TrackedLine } from '../core/editing';
import type { Line } from '../core/lines';
import type { ItemBlock } from '../core/parse';
import { setStar } from '../core/star';
import { dayAfter, dayOf, setWhen } from '../core/when';
import { openCard } from './card';
import { whenClick, WHEN_INPUT_CLASS } from './card-when';
import { queueLineEdit } from './line-edit';
import type { PrinceListView } from './list-view';
import { atLine } from './menu-anchor';
import { queueTickAt } from './tick';

// What the item's card does, from its row's right-click menu: tick, star and the date. Each entry
// says what the item holds when the menu opens, and does just that.
export function itemQuickMenu(view: PrinceListView, item: ItemBlock, row: HTMLElement, anchor: TrackedLine, menu: Menu): void {
	const { done, starred, when } = timelessItemRow((view.lines()[item.titleLine] as Line).text, item.titleLine);
	const setDay = (day: () => string | null) => atLine(anchor, (line) => queueLineEdit(view, line, (text) => setWhen(text, day())));
	menu.addItem((entry) =>
		entry
			.setTitle(done ? 'Untick' : 'Tick')
			.setIcon(done ? 'square' : 'check')
			.onClick(atLine(anchor, (line) => queueTickAt(view, line, row, !done))),
	);
	menu.addItem((entry) =>
		entry
			.setTitle(starred ? 'Remove star' : 'Add star')
			.setIcon(starred ? 'star-off' : 'star')
			.onClick(atLine(anchor, (line) => queueLineEdit(view, line, (text) => setStar(text, !starred)))),
	);
	menu.addSeparator();
	menu.addItem((entry) => entry.setTitle('Set date to today').setIcon('calendar-check').onClick(setDay(() => dayOf(new Date()))));
	menu.addItem((entry) => entry.setTitle('Set date to tomorrow').setIcon('calendar-plus').onClick(setDay(() => dayAfter(new Date()))));
	menu.addItem((entry) => entry.setTitle('Set date…').setIcon('calendar').onClick(atLine(anchor, (line) => pickDate(view, line))));
	if (when !== null) menu.addItem((entry) => entry.setTitle('Remove date').setIcon('calendar-x').onClick(setDay(() => null)));
	menu.addSeparator();
}

// The item's card opens with the platform's date picker, which sets the date as the card's own
// does. The picker needs a recent user action, which a native menu's click may not count as, and
// without one the card's date button opens it.
function pickDate(view: PrinceListView, line: number): void {
	openCard(view, line);
	const input = view.card?.el.querySelector<HTMLInputElement>(`.${WHEN_INPUT_CLASS}`);
	if (input && navigator.userActivation.isActive) whenClick(input);
}
