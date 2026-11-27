import { NO_LIT_TAGS } from '../core/tags';
import { dismissCard } from './card';
import type { PrinceListView } from './list-view';

/**
 * Resets the view to an empty, unfiltered list for TextFileView's per-file `clear()`. Nothing here
 * writes: an empty new item stays when the file switches (spec, "Selecting and adding").
 */
export function clearList(view: PrinceListView): void {
	dismissCard(view);
	view.editing.reset();
	view.editing.text = '';
	view.listTitle = null;
	view.endListNote();
	view.dropListNoteEditor();
	view.listNoteEl = null;
	view.headingField = null;
	view.showArchived = false;
	view.starredOnly = false;
	view.litTags = NO_LIT_TAGS;
	view.filter = null;
	view.filterField = null;
	view.collapsed.clear();
	view.selection.clear();
	view.outsideChanges++;
	// Nothing of the old file stays, not even a field with focus, which render() would keep.
	view.listSizerEl.empty();
	// A different file opens at the top; render() keeps the scroll position otherwise.
	view.listScrollEl.scrollTop = 0;
}
