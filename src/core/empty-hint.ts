/**
 * What an empty list says about adding its first item. `addKeyName` is the add key's name, as
 * "Cmd+Enter", or null where there is no keyboard key (mobile); `showsPlus` is whether a "+" that
 * adds an item shows. With neither, Enter in the title starts the first item.
 */
export function emptyHint(addKeyName: string | null, showsPlus: boolean): string {
	if (addKeyName === null) return showsPlus ? 'Tap + to add an item' : 'Press Enter in the title to add an item';
	return showsPlus ? `Press ${addKeyName} or + to add an item` : `Press ${addKeyName} to add an item`;
}
