import { type Menu, TextFileView, type ViewStateResult } from 'obsidian';
import { VIEW_TYPE_LIST, VIEW_TYPE_MARKDOWN } from '../constants';
import { isListText } from '../obsidian/marker';
import { openAsMarkdown } from '../obsidian/switch';

const OPEN_AS_MARKDOWN_CLASS = 'princelists-open-as-markdown';

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
		const isList = isListText(data);
		this.render(isList);
		// Only a reload (`clear` false) switches. A switch from inside the leaf's own load doesn't
		// take effect, and a later one would record a Back entry that lands here again, so Back
		// would loop (spec, "Opening and switching views"). A load shows the button instead.
		if (!isList && !clear && this.file) {
			// Not through openAsMarkdown: the user didn't choose Markdown, so the pane mustn't
			// stay Markdown when it next opens a list.
			void this.leaf.setViewState({ type: VIEW_TYPE_MARKDOWN, state: { file: this.file.path } });
		}
	}

	clear(): void {
		this.text = '';
	}

	protected async onOpen(): Promise<void> {
		await super.onOpen();
		// One delegated listener on the view's own element, which goes away with the view.
		this.contentEl.on('click', `.${OPEN_AS_MARKDOWN_CLASS}`, () => {
			if (this.file) void openAsMarkdown(this.leaf, this.file);
		});
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

	private render(isList: boolean): void {
		this.contentEl.empty();
		this.contentEl.createEl('h2', { text: this.file?.basename ?? '' });
		if (isList) {
			this.contentEl.createEl('p', { text: 'List view' });
			return;
		}
		this.contentEl.createEl('p', { text: "This note isn't a list" });
		this.contentEl.createEl('button', { text: 'Open as Markdown', cls: OPEN_AS_MARKDOWN_CLASS });
	}
}
