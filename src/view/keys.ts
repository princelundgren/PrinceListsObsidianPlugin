import { Scope } from 'obsidian';
import type { Format } from '../core/format';
import { isListText } from '../obsidian/marker';
import { newItem } from './add-button';
import { targetOf } from './dom';
import { openFilter } from './filter';
import { applyFormat } from './format';
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
	// In a card's title and notes, as in a note. Anywhere else the key is Obsidian's.
	view.scope.register(['Mod'], 'b', (evt) => formatKey(view, evt, 'bold'));
	view.scope.register(['Mod'], 'i', (evt) => formatKey(view, evt, 'italic'));
	view.scope.register(['Mod'], 'k', (evt) => formatKey(view, evt, 'link'));
}

function formatKey(view: PrinceListView, evt: KeyboardEvent, format: Format): boolean {
	const field = targetOf(evt);
	if (!field?.instanceOf(HTMLTextAreaElement) || !view.card?.el.contains(field)) return true;
	applyFormat(field, format);
	return false;
}
