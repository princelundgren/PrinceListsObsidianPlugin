import { openCard } from './card';
import type { PrinceListView } from './list-view';

// An edit since the Schedule view last read the list may have put another item on that line.
export function openItem(view: PrinceListView, titleLine: number, line: string): void {
	if (view.lines()[titleLine]?.text !== line) return;
	openCard(view, titleLine);
	view.card?.el.scrollIntoView({ block: 'nearest' });
}
