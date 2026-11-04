import { FuzzySuggestModal, type App, type TFile } from 'obsidian';
import type { EditableText } from './editable-text';
import type { PrinceListView } from './list-view';

/**
 * Asks for a note or list, then links to it in `text` as the vault's link settings say. Selected text
 * on one line becomes the link's text; a selection over lines stays, with the link after it.
 */
export function insertNoteLink(view: PrinceListView, text: EditableText): void {
	if (text.isReadOnly) return;
	const card = view.card;
	// The search box takes focus, and a card title's field gets its saved title back when it loses it.
	const restoreSelection = text.holdSelection();
	const selected = text.selectedText();
	const isOneLine = !selected.includes('\n');
	new NoteLinkModal(view.app, (file) => {
		// The card may have closed or been lost while the search box was open.
		if (view.card !== card || (card && card.lostAt !== null)) return;
		text.focus();
		restoreSelection();
		const link = view.app.fileManager.generateMarkdownLink(file, view.sourcePath, undefined, isOneLine ? selected || undefined : undefined);
		text.replaceSelection(isOneLine ? link : selected + link);
	}).open();
}

/** Asks for a note or list in the vault, the most recently changed first, and hands the choice to `onChoose`. */
class NoteLinkModal extends FuzzySuggestModal<TFile> {
	// Sorted once: the search box asks for the items again at every keystroke.
	private readonly files: TFile[];

	constructor(
		app: App,
		private readonly onChoose: (file: TFile) => void,
	) {
		super(app);
		this.setPlaceholder('Link to a note or list');
		this.files = app.vault.getMarkdownFiles().sort((a, b) => b.stat.mtime - a.stat.mtime);
	}

	override getItems(): TFile[] {
		return this.files;
	}

	override getItemText(file: TFile): string {
		return file.path.slice(0, -`.${file.extension}`.length);
	}

	override onChooseItem(file: TFile): void {
		this.onChoose(file);
	}
}
