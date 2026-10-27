import { Scope } from 'obsidian';
import { newItem } from './add-button';
import type { PrinceListView } from './list-view';
import { redoKey, undoKey } from './undo';

// The view's own keys, which apply only while the list has focus, so none is a default hotkey.
export function registerListKeys(view: PrinceListView): void {
	view.scope = new Scope(view.app.scope);
	view.scope.register(['Mod'], 'z', (evt) => undoKey(view, evt));
	view.scope.register(['Mod', 'Shift'], 'z', (evt) => redoKey(view, evt));
	// In every field too, a card's included, as "+" would.
	view.scope.register(['Mod'], 'Enter', () => {
		newItem(view);
		return false;
	});
}
