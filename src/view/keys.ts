import { Platform, Scope, type Modifier } from 'obsidian';
import type { Format } from '../core/format';
import { modKeyName } from '../core/key-name';
import { isListText } from '../obsidian/marker';
import { targetOf } from './dom';
import { openFilter } from './filter';
import { applyFormat } from './format';
import type { PrinceListView } from './list-view';
import { eventInDrawnListBlock } from './notes-blocks';
import { extendSelection, newItemBelowSelection } from './select';
import { redoKey, undoKey } from './undo';

const ADD_KEY = 'Enter';

/** The add key's name on this platform, as "Cmd+Enter", or null on mobile. */
export const ADD_KEY_NAME = modKeyName(Platform, ADD_KEY);

const FIND_KEY = 'f';

/** The find key's name on this platform, as "Cmd+F", or null on mobile. */
export const FIND_KEY_NAME = modKeyName(Platform, FIND_KEY.toUpperCase());

const ARCHIVED_KEY = 'A';

/** The show-archived key's name on this platform, as "Cmd+Shift+A", or null on mobile. */
export const ARCHIVED_KEY_NAME = modKeyName(Platform, `Shift+${ARCHIVED_KEY}`);

// The view's own keys, which apply only while the list has focus, so none is a default hotkey.
export function registerListKeys(view: PrinceListView): void {
	const scope = new Scope(view.app.scope);
	view.scope = scope;
	// A key in a list block drawn in the notes, on the drawn block itself too, is the block's, as in a
	// note: returning true leaves the key's default in place, where false would prevent it.
	const register = (modifiers: Modifier[], key: string, func: (evt: KeyboardEvent) => boolean): void => {
		scope.register(modifiers, key, (evt) => eventInDrawnListBlock(view.contentEl, evt) || func(evt));
	};
	register(['Mod'], 'z', (evt) => undoKey(view, evt));
	register(['Mod', 'Shift'], 'z', (evt) => redoKey(view, evt));
	// In every field too, a card's included, as "+" would. In a note that isn't a list, the key is Obsidian's.
	register(['Mod'], ADD_KEY, () => {
		if (!isListText(view.text)) return true;
		newItemBelowSelection(view);
		return false;
	});
	// Not in a field, where Shift+Up and Shift+Down keep selecting text.
	register(['Shift'], 'ArrowUp', (evt) => isInField(evt) || !extendSelection(view, -1));
	register(['Shift'], 'ArrowDown', (evt) => isInField(evt) || !extendSelection(view, 1));
	// Only while the list has focus: elsewhere Cmd+F stays Obsidian's search.
	register(['Mod'], FIND_KEY, () => {
		if (!isListText(view.text)) return true;
		openFilter(view);
		return false;
	});
	// As the archived toggle does, in every field too. In a note that isn't a list, the key is Obsidian's.
	register(['Mod', 'Shift'], ARCHIVED_KEY, () => {
		if (!isListText(view.text)) return true;
		view.toggleArchived();
		return false;
	});
	// In the card's title, as in a note; the notes editor has its own. Anywhere else the key is Obsidian's.
	register(['Mod'], 'b', (evt) => formatKey(view, evt, 'bold'));
	register(['Mod'], 'i', (evt) => formatKey(view, evt, 'italic'));
	register(['Mod'], 'k', (evt) => formatKey(view, evt, 'link'));
}

function formatKey(view: PrinceListView, evt: KeyboardEvent, format: Format): boolean {
	const field = targetOf(evt);
	if (!field?.instanceOf(HTMLTextAreaElement)) return true;
	if (!view.card?.el.contains(field)) return true;
	applyFormat(field, format);
	return false;
}

function isInField(evt: KeyboardEvent): boolean {
	const target = targetOf(evt);
	if (!target) return false;
	if (target.instanceOf(HTMLInputElement)) return target.type !== 'checkbox';
	return target.instanceOf(HTMLTextAreaElement) || target.isContentEditable;
}
