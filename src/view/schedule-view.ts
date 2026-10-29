import { ItemView, Notice, Platform, TFile, type CachedMetadata, type Component, type TAbstractFile } from 'obsidian';
import { SCHEDULE_ICON, VIEW_TYPE_LIST, VIEW_TYPE_SCHEDULE } from '../constants';
import { toggleItem } from '../core/edit-items';
import { isMarkerValue } from '../core/frontmatter';
import { joinLines, splitLines } from '../core/lines';
import { itemAt, parseList } from '../core/parse';
import { serialQueue } from '../core/queue';
import { datedItems, groupSchedule, unarchived, type ScheduledItem, type ScheduleGroup } from '../core/schedule';
import { dayOf } from '../core/when';
import { editListFile } from '../obsidian/file-edit';
import { contentStartLine } from '../obsidian/marker';
import { openAsList } from '../obsidian/switch';
import { addHiddenLabel, targetOf } from './dom';
import { PrinceListView } from './list-view';
import { handleLinkClick, renderInline, type MarkdownHost } from './notes';
import { openItem } from './open-item';
import { CHECKBOX_CLASS, HEADING_CLASS, ITEM_CLASS, ITEMS_CLASS } from './render-list';
import { addStar, addWhen } from './row-marks';
import { CHANGED_ELSEWHERE_NOTICE, tryEdit } from './write';

const GROUP_NAMES: Record<ScheduleGroup, string> = {
	today: 'Today',
	tomorrow: 'Tomorrow',
	week: 'Next 7 days',
	later: 'Later',
};

const SCHEDULE_ABOUT = 'Every item with a date, from all your lists, by day. To plan an item, open it in its list and pick a day with the calendar icon on its card.';

// A list as the view last read it: a tick is worked out on that text.
interface ReadList {
	text: string;
	items: ScheduledItem[];
}

// Every list's items with a When, by day (spec, "When and the Schedule view").
export class ScheduleView extends ItemView implements MarkdownHost {
	private lists = new Map<string, ReadList>();
	private readonly rows = new WeakMap<Element, ScheduledItem>();
	// Ticks run in turn, so each is worked out on the text the one before it wrote.
	private readonly enqueue = serialQueue((error) => console.error(error));
	// Paths an event updated while a refresh was reading, which its older reads must not overwrite.
	// null while no refresh is reading.
	private updatedPaths: Set<string> | null = null;
	private refreshes = 0;
	private blocks: Component[] = [];
	// Today and the groups as drawn last. Every field counts: the rows keep these items, and ticks use their lines.
	private drawn: string | null = null;
	// Its own scrolling element, as a list's, so the page takes the list's margins.
	private readonly scrollEl = this.contentEl.createDiv({ cls: 'princelists-scroll' });

	getViewType(): string {
		return VIEW_TYPE_SCHEDULE;
	}

	getDisplayText(): string {
		return 'Schedule';
	}

	getIcon(): string {
		return SCHEDULE_ICON;
	}

	async onOpen(): Promise<void> {
		this.contentEl.addClass('princelists-content', 'princelists-schedule');
		this.contentEl.toggleClass('princelists-is-mobile', Platform.isMobile);
		const { workspace, metadataCache, vault } = this.app;
		this.registerEvent(workspace.on('active-leaf-change', (leaf) => {
			if (leaf === this.leaf) void this.refresh();
		}));
		this.registerEvent(metadataCache.on('changed', (file, data, cache) => this.listChanged(file, data, cache)));
		this.registerEvent(vault.on('rename', (file, oldPath) => void this.listRenamed(file, oldPath)));
		this.registerEvent(vault.on('delete', (file) => this.listDeleted(file.path)));
		this.registerDomEvent(this.contentEl, 'click', (evt) => this.onClick(evt));
		await this.refresh();
	}

	async onClose(): Promise<void> {
		// A refresh still reading draws nothing once it finishes.
		this.refreshes++;
		this.drawn = null;
		this.lists.clear();
		this.removeBlocks();
	}

	async refresh(): Promise<void> {
		const refresh = ++this.refreshes;
		const updatedPaths = new Set<string>();
		this.updatedPaths = updatedPaths;
		const { vault, metadataCache } = this.app;
		const files = vault.getMarkdownFiles().filter((file) => isList(metadataCache.getFileCache(file)));
		// The events keep a held list current.
		const read = await Promise.all(
			files.map(async (file) => [file.path, this.lists.get(file.path) ?? readList(file, await vault.cachedRead(file))] as const),
		);
		if (refresh !== this.refreshes) return;
		this.updatedPaths = null;
		const lists = new Map(read.filter(([path]) => !updatedPaths.has(path)));
		for (const path of updatedPaths) {
			const list = this.lists.get(path);
			if (list) lists.set(path, list);
		}
		this.lists = lists;
		this.draw();
	}

	private listChanged(file: TFile, text: string, cache: CachedMetadata): void {
		if (isList(cache)) this.listRead(file, text);
		else this.listDeleted(file.path);
	}

	private listRead(file: TFile, text: string): void {
		this.updatedPaths?.add(file.path);
		this.lists.set(file.path, readList(file, text));
		this.draw();
	}

	private async listRenamed(file: TAbstractFile, oldPath: string): Promise<void> {
		this.updatedPaths?.add(oldPath).add(file.path);
		const wasList = this.lists.delete(oldPath);
		if (file instanceof TFile && isList(this.app.metadataCache.getFileCache(file))) {
			this.lists.set(file.path, readList(file, await this.app.vault.cachedRead(file)));
		} else if (!wasList) {
			return;
		}
		this.draw();
	}

	private listDeleted(path: string): void {
		this.updatedPaths?.add(path);
		if (this.lists.delete(path)) this.draw();
	}

	private onClick(evt: MouseEvent): void {
		const target = targetOf(evt);
		const rowEl = target?.closest(`.${ITEM_CLASS}`);
		const item = rowEl && this.rows.get(rowEl);
		if (!target || !item || handleLinkClick(this.app, item.listPath, evt, target)) return;
		if (target.closest(`.${CHECKBOX_CLASS}`)) {
			// The box shows the file: the redraw after the write ticks it.
			evt.preventDefault();
			void this.enqueue(() => this.tick(item));
		} else {
			void this.openItem(item);
		}
	}

	private async tick(item: ScheduledItem): Promise<void> {
		const list = this.lists.get(item.listPath);
		const file = this.app.vault.getFileByPath(item.listPath);
		if (!list || !file) {
			new Notice(CHANGED_ELSEWHERE_NOTICE);
			return;
		}
		const lines = splitLines(list.text);
		const block = itemAt(parseList(lines, contentStartLine(list.text)), item.titleLine);
		// A change since the row was drawn may have put another item on its line.
		if (!block || lines[item.titleLine]?.text !== item.line) {
			new Notice(CHANGED_ELSEWHERE_NOTICE);
			return;
		}
		const edited = tryEdit(() => toggleItem(lines, block, new Date()));
		if (!edited) return;
		const next = joinLines(edited);
		// Taken at once, so the next tick in this list builds on it before the metadata cache catches up.
		if ((await editListFile(this.app, file, list.text, next)) === 'written') this.listRead(file, next);
	}

	// In a tab that already shows the list, else a new one.
	private async openItem(item: ScheduledItem): Promise<void> {
		const file = this.app.vault.getFileByPath(item.listPath);
		if (!file) {
			new Notice(CHANGED_ELSEWHERE_NOTICE);
			return;
		}
		const { workspace } = this.app;
		// By its state, which a tab restored in the background keeps while its view waits to load.
		const shown = workspace.getLeavesOfType(VIEW_TYPE_LIST).find((leaf) => leaf.getViewState().state?.file === file.path);
		const leaf = shown ?? workspace.getLeaf('tab');
		if (!(leaf.view instanceof PrinceListView && leaf.view.file === file)) await openAsList(leaf, file);
		workspace.setActiveLeaf(leaf, { focus: true });
		if (leaf.view instanceof PrinceListView && leaf.view.file === file) openItem(leaf.view, item.titleLine, item.line);
	}

	private draw(): void {
		const now = new Date();
		const today = dayOf(now);
		const groups = groupSchedule([...this.lists.values()].flatMap((list) => unarchived(list.items, now)), today);
		const drawn = JSON.stringify([today, groups]);
		if (drawn === this.drawn) return;
		this.drawn = drawn;
		const scroll = this.scrollEl.scrollTop;
		this.removeBlocks();
		this.scrollEl.empty();
		const sizer = this.scrollEl.createDiv({ cls: 'princelists-sizer' });
		sizer.createDiv({ cls: 'princelists-schedule-title', text: 'Schedule', attr: { role: 'heading', 'aria-level': 1 } });
		sizer.createDiv({ cls: 'princelists-schedule-about', text: SCHEDULE_ABOUT });
		if (groups.length === 0) sizer.createDiv({ cls: 'princelists-schedule-empty', text: 'No items have a date.' });
		for (const { group, items } of groups) {
			sizer.createDiv({ cls: HEADING_CLASS, text: GROUP_NAMES[group], attr: { role: 'heading', 'aria-level': 2 } });
			const list = sizer.createEl('ul', { cls: ITEMS_CLASS });
			for (const item of items) list.append(this.buildRow(item, today));
		}
		this.scrollEl.scrollTop = scroll;
	}

	private buildRow(item: ScheduledItem, today: string): HTMLLIElement {
		const rowEl = createEl('li', { cls: ITEM_CLASS });
		rowEl.toggleClass('is-done', item.done);
		const box = rowEl.createEl('input', { cls: CHECKBOX_CLASS, type: 'checkbox' });
		box.checked = item.done;
		addHiddenLabel(box, item.title);
		const text = rowEl.createDiv({ cls: 'princelists-schedule-text' });
		const titleLine = text.createDiv({ cls: 'princelists-schedule-title-line' });
		const block = renderInline(this, item.listPath, titleLine.createDiv({ cls: 'princelists-item-title' }), item.title);
		if (block) this.blocks.push(block);
		if (item.starred) addStar(titleLine);
		addWhen(titleLine, item.day, today);
		text.createDiv({ cls: 'princelists-schedule-list', text: item.listName });
		this.rows.set(rowEl, item);
		return rowEl;
	}

	private removeBlocks(): void {
		for (const block of this.blocks) this.removeChild(block);
		this.blocks = [];
	}
}

function isList(cache: CachedMetadata | null): boolean {
	return isMarkerValue(cache?.frontmatter);
}

function readList(file: TFile, text: string): ReadList {
	return { text, items: datedItems(text, contentStartLine(text), { path: file.path, name: file.basename }) };
}
