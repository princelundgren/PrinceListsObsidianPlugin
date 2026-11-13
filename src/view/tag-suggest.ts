import { AbstractInputSuggest } from 'obsidian';
import { listStripTags } from '../core/display';
import { tagChoices, type TagChoice } from '../core/tag-choices';
import type { PrinceListView } from './list-view';
import { redoKey, undoKey } from './undo';

/** What a tag type-ahead serves: the tags it leaves out, and what choosing one does. */
export interface TagTarget {
	/** The tags to leave out of the suggestions, read each time they are computed. */
	tagsToLeaveOut(): readonly string[];
	/** Acts on the chosen tag. */
	choose(tag: string): void;
}

/** The list's tags as its strip shows them with nothing lit, the order the tag type-ahead and popovers follow. */
export function stripTagOrder(view: PrinceListView): string[] {
	const { lines, model } = view.parse();
	const shown = { showArchived: view.showArchived, archiveDelayMs: view.archiveDelay.ms };
	return listStripTags(lines, model, new Date(), shown, []);
}

/**
 * A tag type-ahead: the list's tags, as its strip shows them with nothing lit, and the typed tag as
 * new, less the target's tags to leave out. Choosing one calls the target's `choose`.
 */
export class TagSuggest extends AbstractInputSuggest<TagChoice> {
	constructor(
		private readonly listView: PrinceListView,
		textInputEl: HTMLInputElement,
		private readonly target: TagTarget,
	) {
		super(listView.app, textInputEl);
		// While the suggestions show, their scope takes the keys, and its parent is the app's, not the view's.
		this.scope.register(['Mod'], 'z', (evt) => undoKey(listView, evt));
		this.scope.register(['Mod', 'Shift'], 'z', (evt) => redoKey(listView, evt));
	}

	protected override getSuggestions(query: string): TagChoice[] {
		return tagChoices(stripTagOrder(this.listView), this.target.tagsToLeaveOut(), query);
	}

	override renderSuggestion(choice: TagChoice, el: HTMLElement): void {
		el.setText(choice.isNew ? `New tag: #${choice.tag}` : `#${choice.tag}`);
	}

	override selectSuggestion(choice: TagChoice): void {
		this.target.choose(choice.tag);
	}
}
