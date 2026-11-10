import { Notice, prepareSimpleSearch, renderResults, SuggestModal } from 'obsidian';
import type { TrackedLine } from '../core/editing';
import { headingChoices, type HeadingChoice } from '../core/group-edits';
import { contentStartLine } from '../obsidian/marker';
import type { PrinceListView } from './list-view';
import { CHANGED_ELSEWHERE_NOTICE } from './write';

/**
 * Asks where in the view's list to move the selection: "Top of the list" or one of its headings,
 * narrowed as the user types. Hands the chosen heading's line, or null for the top, to `onChoose`;
 * the heading lines follow the view's edits while the picker is open, and a heading that went shows
 * a notice instead.
 */
export class HeadingPickerModal extends SuggestModal<HeadingChoice> {
	private readonly choices: HeadingChoice[];
	private readonly tracked = new Map<HeadingChoice, TrackedLine>();

	constructor(
		private readonly view: PrinceListView,
		private readonly onChoose: (headingLine: number | null) => void,
	) {
		super(view.app);
		this.choices = headingChoices(view.text, contentStartLine(view.text));
		for (const choice of this.choices) {
			if (choice.headingLine !== null) this.tracked.set(choice, view.editing.track(choice.headingLine));
		}
	}

	override getSuggestions(query: string): HeadingChoice[] {
		if (query.trim() === '') return this.choices;
		const matches = prepareSimpleSearch(query);
		return this.choices.filter((choice) => matches(choice.label));
	}

	override renderSuggestion(choice: HeadingChoice, el: HTMLElement): void {
		const query = this.inputEl.value;
		const result = query.trim() === '' ? null : prepareSimpleSearch(query)(choice.label);
		if (result) renderResults(el, choice.label, result);
		else el.setText(choice.label);
	}

	override onChooseSuggestion(choice: HeadingChoice): void {
		const tracked = this.tracked.get(choice);
		if (tracked?.line === null) new Notice(CHANGED_ELSEWHERE_NOTICE);
		else this.onChoose(tracked ? tracked.line : null);
	}

	override onClose(): void {
		super.onClose();
		for (const tracked of this.tracked.values()) this.view.editing.untrack(tracked);
	}
}
