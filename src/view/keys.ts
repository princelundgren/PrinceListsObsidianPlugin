import { Scope } from 'obsidian';
import { isListText } from '../obsidian/marker';
import { newItem } from './add-button';
import { openFilter } from './filter';
import type { PrinceListView } from './list-view';
import { redoKey, undoKey } from './undo';

// The view's own keys, which apply only while the list has focus, so none is a default hotkey.
export function registerListKeys(view: PrinceListView): void {
	view.scope = new Scope(view.app.scope);
	view.scope.register(['Mod'], 'z', (evt) => undoKey(view, evt));
	view.scope.register(['Mod', 'Shift'], 'z', (evt) => redoKey(view, evt));
	// In every field too, a card's included, as "+" would. In a note that isn't a list, the key is Obsidian's.
	view.scope.register(['Mod'], 'Enter', () => {
		if (!isListText(view.text)) return true;
		newItem(view);
		return false;
	});
	// Only while the list has focus: elsewhere Cmd+F stays Obsidian's search.
	view.scope.register(['Mod'], 'f', () => {
		if (!isListText(view.text)) return true;
		openFilter(view);
		return false;
	});
}
