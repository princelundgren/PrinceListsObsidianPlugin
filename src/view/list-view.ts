import { type Menu, TextFileView, type TFile, type ViewStateResult } from 'obsidian';
import { VIEW_TYPE_LIST, VIEW_TYPE_MARKDOWN } from '../constants';
import { itemRow } from '../core/display';
import { toggleItem } from '../core/edit-items';
import { joinLines, splitLines, type Line } from '../core/lines';
import { parseList } from '../core/parse';
import { serialQueue } from '../core/queue';
import { contentStartLine, isListText } from '../obsidian/marker';
import { openAsMarkdown } from '../obsidian/switch';
import { CHECKBOX_CLASS, ITEM_CLASS, renderList, showDone } from './render-list';
import { tryEdit, writeAction } from './write';

const OPEN_AS_MARKDOWN_CLASS = 'princelists-open-as-markdown';

// canAcceptExtension stays at its default of false: true would open every note clicked from a
// list pane in the list view.
export class PrinceListView extends TextFileView {
	// The exact file text. Kept apart from the inherited `data` because it holds each keystroke,
	// for getViewData and Obsidian's merge.
	text = '';
	// Off each time a list opens: clear() turns it off, and it stays out of getState and local
	// storage, so nothing restores it (spec, "Done and archived").
	showArchived = false;
	// Each tap waits for the one before it to write, then edits the text as that write left it, so
	// two quick taps on one box tick and untick it, and taps on two rows both land.
	private readonly queueTap = serialQueue((error) => console.error(error));

	getViewType(): string {
		return VIEW_TYPE_LIST;
	}

	getViewData(): string {
		return this.text;
	}

	setViewData(data: string, clear: boolean): void {
		// The view's own writes come back here as a reload of the text it already holds (spec,
		// "Saving and outside changes"), and a redraw would tear down a field that has focus.
		if (!clear && data === this.text) return;
		// TextFileView's per-file reset, for when a different file loads.
		if (clear) this.clear();
		this.text = data;
		this.render();
		// Only a reload (`clear` false) switches. A switch from inside the leaf's own load doesn't
		// take effect, and a later one would record a Back entry that lands here again, so Back
		// would loop (spec, "Opening and switching views"). A load shows the button instead.
		if (!isListText(data) && !clear && this.file) {
			// Not through openAsMarkdown: the user didn't choose Markdown, so this note mustn't be
			// held as Markdown in this pane if its marker comes back.
			void this.leaf.setViewState({ type: VIEW_TYPE_MARKDOWN, state: { file: this.file.path } });
		}
	}

	clear(): void {
		this.text = '';
		this.showArchived = false;
		// A different file opens at the top; render() keeps the scroll position otherwise.
		this.contentEl.scrollTop = 0;
	}

	protected async onOpen(): Promise<void> {
		await super.onOpen();
		// One delegated listener on the view's own element, which goes away with the view.
		this.contentEl.on('click', `.${OPEN_AS_MARKDOWN_CLASS}, .${CHECKBOX_CLASS}`, (evt, target) => {
			if (target.hasClass(OPEN_AS_MARKDOWN_CLASS)) {
				if (this.file) void openAsMarkdown(this.leaf, this.file);
				return;
			}
			// The box shows what the file holds: it changes once the write lands, not while a tap waits.
			evt.preventDefault();
			const row = target.closest<HTMLElement>(`.${ITEM_CLASS}`);
			if (row) void this.queueTap(() => this.toggle(row));
		});
	}

	async onRename(file: TFile): Promise<void> {
		await super.onRename(file);
		this.render();
	}

	// setViewState records a history entry when the view type changes, so Back would land on the
	// same note as Markdown. `ViewStateResult.history` is documented; that `false` keeps the entry
	// out is observed (1.14.4, spike 1's check 4).
	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		await super.setState(state, result);
		result.history = false;
	}

	onPaneMenu(menu: Menu, source: string): void {
		super.onPaneMenu(menu, source);
		if (isListText(this.text)) {
			menu.addItem((item) =>
				item
					.setTitle('Show archived')
					.setIcon('archive')
					.setChecked(this.showArchived)
					.onClick(() => {
						this.showArchived = !this.showArchived;
						this.render();
					}),
			);
		}
		menu.addItem((item) =>
			item
				.setTitle('Open as Markdown')
				.setIcon('file-text')
				.onClick(() => {
					if (this.file) void openAsMarkdown(this.leaf, this.file);
				}),
		);
	}

	// Parsed from `text`, which the write's guard expects, not taken from the last render: an earlier
	// tick may have changed `text` since, and an edit of the older lines would undo it.
	private async toggle(row: HTMLElement): Promise<void> {
		// A redraw while this tap waited, as for an outside change, may have moved lines. Ticking the
		// wrong item is worse than dropping the tap.
		if (!row.isConnected) return;
		const titleLine = Number(row.dataset.line);
		const lines = splitLines(this.text);
		const items = parseList(lines, contentStartLine(this.text)).sections.flatMap((section) => section.items);
		const item = items.find((candidate) => candidate.titleLine === titleLine);
		if (!item) return;
		const edited = tryEdit(() => toggleItem(lines, item, new Date()));
		if (!edited || !(await writeAction(this, joinLines(edited)))) return;
		// Obsidian's echo of this write returns early in setViewData, so the row is updated here. A
		// tick moves no line, so the row still stands for this item. A redraw during the write, such
		// as "Show archived", drew from the text before the tick, so the view redraws again.
		if (row.isConnected) showDone(row, itemRow((edited[titleLine] as Line).text, titleLine).done);
		else this.render();
	}

	private render(): void {
		// contentEl is what scrolls in Obsidian's CSS as seen in 1.14.4 (not a documented API), so the
		// floating "+" (Task 10) must sit outside it.
		const { scrollTop } = this.contentEl;
		this.contentEl.empty();
		this.contentEl.createEl('h1', { cls: 'princelists-title', text: this.file?.basename ?? '' });
		if (isListText(this.text)) {
			renderList(this.contentEl, this.text, this.showArchived);
		} else {
			this.contentEl.createEl('p', { text: "This note isn't a list" });
			this.contentEl.createEl('button', { text: 'Open as Markdown', cls: OPEN_AS_MARKDOWN_CLASS });
		}
		this.contentEl.scrollTop = scrollTop;
	}
}
