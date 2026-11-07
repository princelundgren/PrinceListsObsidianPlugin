import { AbstractInputSuggest } from 'obsidian';
import { listStripTags } from '../core/display';
import { itemTags } from '../core/item-tags';
import { tagChoices, type TagChoice } from '../core/tag-choices';
import { addTag } from '../core/tag-edit';
import { queueLineEdit } from './line-edit';
import type { PrinceListView } from './list-view';

/**
 * The card's tag type-ahead: the list's tags, as its strip shows them with no tag lit, and the typed
 * tag as new. Choosing one adds it to the open card's item, then clears the input for the next.
 */
export class TagSuggest extends AbstractInputSuggest<TagChoice> {
	constructor(
		private readonly listView: PrinceListView,
		textInputEl: HTMLInputElement,
	) {
		super(listView.app, textInputEl);
	}

	protected override getSuggestions(query: string): TagChoice[] {
		const view = this.listView;
		const { lines, model } = view.parse();
		const shown = { showArchived: view.showArchived, archiveDelayMs: view.archiveDelay.ms };
		const line = view.selected === null ? undefined : lines[view.selected];
		return tagChoices(listStripTags(lines, model, new Date(), shown, []), itemTags(line?.text ?? '').tags, query);
	}

	override renderSuggestion(choice: TagChoice, el: HTMLElement): void {
		el.setText(choice.isNew ? `New tag: #${choice.tag}` : `#${choice.tag}`);
	}

	// The open card's item when the choice is made, which may have moved since the input opened. The
	// suggestions close until the next keystroke, since the write that adds the tag hasn't landed.
	override selectSuggestion(choice: TagChoice): void {
		const view = this.listView;
		if (view.selected !== null) queueLineEdit(view, view.selected, (text) => addTag(text, choice.tag));
		this.setValue('');
		this.close();
		view.tagInput?.input.focus();
	}
}
