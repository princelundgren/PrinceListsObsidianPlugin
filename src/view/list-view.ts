import { type Menu, TextFileView, type ViewStateResult } from 'obsidian';
import { VIEW_TYPE_LIST, VIEW_TYPE_MARKDOWN } from '../constants';
import { isListText } from '../obsidian/marker';
import { openAsMarkdown } from '../obsidian/switch';

// canAcceptExtension stays at its default of false: true would open every note clicked from a
// list pane in the list view.
export class PrinceListView extends TextFileView {
	// The exact file text. Kept apart from the inherited `data` because it holds each keystroke,
	// for getViewData and Obsidian's merge.
	text = '';

	getViewType(): string {
		return VIEW_TYPE_LIST;
	}

	getViewData(): string {
		return this.text;
	}

	setViewData(data: string, clear: boolean): void {
		if (clear) this.clear();
		this.text = data;
		this.render();
		if (this.file && !isListText(data)) {
			// Not through openAsMarkdown: the user didn't choose Markdown, so the pane mustn't
			// stay Markdown when it next opens a list.
			void this.leaf.setViewState({ type: VIEW_TYPE_MARKDOWN, state: { file: this.file.path } });
		}
	}

	clear(): void {
		this.text = '';
	}

	// setViewState records a history entry when the view type changes, so Back would land on the
	// same note as Markdown. That `false` suppresses the entry is observed, not documented.
	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		await super.setState(state, result);
		result.history = false;
	}

	onPaneMenu(menu: Menu, source: string): void {
		super.onPaneMenu(menu, source);
		menu.addItem((item) =>
			item
				.setTitle('Open as Markdown')
				.setIcon('file-text')
				.onClick(() => {
					if (this.file) void openAsMarkdown(this.leaf, this.file);
				}),
		);
	}

	private render(): void {
		this.contentEl.empty();
		this.contentEl.createEl('h2', { text: this.file?.basename ?? '' });
		this.contentEl.createEl('p', { text: 'List view' });
	}
}
