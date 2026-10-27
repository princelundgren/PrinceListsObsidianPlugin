import { ItemView, TFile, type CachedMetadata, type Component, type TAbstractFile } from 'obsidian';
import { SCHEDULE_ICON, VIEW_TYPE_SCHEDULE } from '../constants';
import { isMarkerValue } from '../core/frontmatter';
import { groupSchedule, scheduledItems, type ScheduledItem, type ScheduleGroup } from '../core/schedule';
import { dayOf } from '../core/when';
import { contentStartLine } from '../obsidian/marker';
import { addHiddenLabel } from './dom';
import { renderInline, type MarkdownHost } from './notes';
import { CHECKBOX_CLASS, HEADING_CLASS, ITEM_CLASS, ITEMS_CLASS } from './render-list';
import { addStar, addWhen } from './row-marks';

const GROUP_NAMES: Record<ScheduleGroup, string> = {
	today: 'Today',
	tomorrow: 'Tomorrow',
	week: 'Coming week',
	month: 'Next month',
	later: 'Later',
};

// Every list's items with a When, by day (spec, "When and the Schedule view").
export class ScheduleView extends ItemView implements MarkdownHost {
	private readonly listItems = new Map<string, ScheduledItem[]>();
	private blocks: Component[] = [];

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
		this.contentEl.addClass('princelists-schedule');
		const { workspace, metadataCache, vault } = this.app;
		this.registerEvent(workspace.on('active-leaf-change', (leaf) => leaf === this.leaf && void this.refresh()));
		this.registerEvent(metadataCache.on('changed', (file, data, cache) => this.listChanged(file, data, cache)));
		this.registerEvent(vault.on('rename', (file, oldPath) => void this.listRenamed(file, oldPath)));
		this.registerEvent(vault.on('delete', (file) => this.listItems.delete(file.path) && this.draw()));
		await this.refresh();
	}

	async onClose(): Promise<void> {
		this.removeBlocks();
	}

	async refresh(): Promise<void> {
		const { vault, metadataCache } = this.app;
		const lists = vault.getMarkdownFiles().filter((file) => isList(metadataCache.getFileCache(file)));
		const read = await Promise.all(lists.map(async (file) => [file.path, itemsOf(file, await vault.cachedRead(file))] as const));
		this.listItems.clear();
		for (const [path, items] of read) this.listItems.set(path, items);
		this.draw();
	}

	private listChanged(file: TFile, text: string, cache: CachedMetadata): void {
		if (isList(cache)) this.listItems.set(file.path, itemsOf(file, text));
		else if (!this.listItems.delete(file.path)) return;
		this.draw();
	}

	private async listRenamed(file: TAbstractFile, oldPath: string): Promise<void> {
		const wasList = this.listItems.delete(oldPath);
		if (file instanceof TFile && isList(this.app.metadataCache.getFileCache(file))) {
			this.listItems.set(file.path, itemsOf(file, await this.app.vault.cachedRead(file)));
		} else if (!wasList) {
			return;
		}
		this.draw();
	}

	private draw(): void {
		const scroll = this.contentEl.scrollTop;
		this.removeBlocks();
		this.contentEl.empty();
		const sizer = this.contentEl.createDiv({ cls: 'princelists-sizer' });
		const today = dayOf(new Date());
		const groups = groupSchedule([...this.listItems.values()].flat(), today);
		if (groups.length === 0) sizer.createDiv({ cls: 'princelists-schedule-empty', text: 'No items have a When.' });
		for (const { group, items } of groups) {
			sizer.createDiv({ cls: HEADING_CLASS, text: GROUP_NAMES[group], attr: { role: 'heading', 'aria-level': 2 } });
			const list = sizer.createEl('ul', { cls: ITEMS_CLASS });
			for (const item of items) list.append(this.buildRow(item, group === 'today' && item.day === today ? null : today));
		}
		this.contentEl.scrollTop = scroll;
	}

	// `today` is null for an item whose day goes without saying: today's, in Today.
	private buildRow(item: ScheduledItem, today: string | null): HTMLLIElement {
		const rowEl = createEl('li', { cls: ITEM_CLASS });
		rowEl.toggleClass('is-done', item.done);
		const box = rowEl.createEl('input', { cls: CHECKBOX_CLASS, type: 'checkbox' });
		box.checked = item.done;
		box.disabled = true;
		addHiddenLabel(box, item.title);
		const block = renderInline(this, item.listPath, rowEl.createDiv({ cls: 'princelists-item-title' }), item.title);
		if (block) this.blocks.push(block);
		if (item.starred) addStar(rowEl);
		rowEl.createSpan({ cls: 'princelists-schedule-list', text: item.listName });
		if (today !== null) addWhen(rowEl, item.day, today);
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

function itemsOf(file: TFile, text: string): ScheduledItem[] {
	return scheduledItems(text, contentStartLine(text), new Date(), { path: file.path, name: file.basename });
}
