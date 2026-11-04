import { ItemView, Platform, type WorkspaceLeaf } from 'obsidian';
import { RIBBON_ICON, VIEW_TYPE_GETTING_STARTED, VIEW_TYPE_SCHEDULE } from '../constants';
import { isMarkerValue } from '../core/frontmatter';
import { NewListTracker, START_STEPS, type StartStep, stepTexts } from '../core/getting-started';
import { openSchedule } from '../obsidian/open-schedule';
import { addHiddenLabel, targetOf } from './dom';
import { CHECKBOX_CLASS, ITEM_CLASS, ITEMS_CLASS } from './render-list';

const TITLE = 'Getting started with PrinceLists';
const ABOUT = "Three things that are easy to miss. The rest you'll find by using a list.";

const BUTTONS: Partial<Record<StartStep, string>> = {
	'make-list': 'Create a list',
	'open-schedule': 'Open schedule',
};

/** What the view needs from the plugin: `createList` makes a list where "Create new list" would. */
export interface GettingStartedActions {
	createList: () => void;
}

/**
 * The tab that shows how to make a list, turn a note into one and open the Schedule (design,
 * "Getting started"). A row ticks itself when the user does its step while the tab is open; nothing
 * is stored.
 */
export class GettingStartedView extends ItemView {
	// A static view, like the Schedule: a file opened from elsewhere gets a tab of its own.
	override navigation = false;
	private readonly rows = new Map<StartStep, HTMLElement>();

	constructor(
		leaf: WorkspaceLeaf,
		private readonly actions: GettingStartedActions,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_GETTING_STARTED;
	}

	getDisplayText(): string {
		return TITLE;
	}

	getIcon(): string {
		return RIBBON_ICON;
	}

	async onOpen(): Promise<void> {
		this.contentEl.addClass('princelists-content', 'princelists-getting-started');
		this.draw();
		this.registerDomEvent(this.contentEl, 'click', (evt) => this.onClick(evt));
		// Inside onLayoutReady, so a tab restored at startup doesn't take the vault's loading for new notes.
		this.app.workspace.onLayoutReady(() => this.watch());
	}

	private draw(): void {
		const scrollEl = this.contentEl.createDiv({ cls: 'princelists-scroll' });
		const sizer = scrollEl.createDiv({ cls: 'princelists-sizer' });
		sizer.createDiv({ cls: 'princelists-start-title', text: TITLE, attr: { role: 'heading', 'aria-level': 1 } });
		sizer.createDiv({ cls: 'princelists-start-about', text: ABOUT });
		const list = sizer.createEl('ul', { cls: ITEMS_CLASS });
		const texts = stepTexts(Platform.isMobile);
		for (const step of START_STEPS) {
			const rowEl = list.createEl('li', { cls: [ITEM_CLASS, 'princelists-start-step'], attr: { 'data-step': step } });
			const box = rowEl.createEl('input', { cls: CHECKBOX_CLASS, type: 'checkbox' });
			addHiddenLabel(box, texts[step].title);
			const text = rowEl.createDiv({ cls: 'princelists-start-text' });
			text.createDiv({ cls: 'princelists-item-title', text: texts[step].title });
			text.createDiv({ cls: 'princelists-start-how', text: texts[step].how });
			const button = BUTTONS[step];
			if (button) rowEl.createEl('button', { cls: 'princelists-start-button', text: button });
			this.rows.set(step, rowEl);
		}
	}

	private watch(): void {
		const { vault, metadataCache, workspace } = this.app;
		const lists = vault.getMarkdownFiles().filter((file) => isMarkerValue(metadataCache.getFileCache(file)?.frontmatter));
		const tracker = new NewListTracker(lists.map((file) => file.path));
		this.registerEvent(vault.on('create', (file) => tracker.created(file.path)));
		this.registerEvent(vault.on('modify', (file) => tracker.modified(file.path)));
		this.registerEvent(vault.on('rename', (file, oldPath) => tracker.renamed(oldPath, file.path)));
		this.registerEvent(vault.on('delete', (file) => tracker.deleted(file.path)));
		this.registerEvent(metadataCache.on('changed', (file, _data, cache) => {
			const step = tracker.indexed(file.path, isMarkerValue(cache.frontmatter));
			if (step) this.tick(step);
		}));
		// By its state, which a tab still waiting to load keeps.
		this.registerEvent(workspace.on('active-leaf-change', (leaf) => {
			if (leaf?.getViewState().type === VIEW_TYPE_SCHEDULE) this.tick('open-schedule');
		}));
	}

	private tick(step: StartStep): void {
		const rowEl = this.rows.get(step);
		if (!rowEl) return;
		rowEl.addClass('is-done');
		const box = rowEl.querySelector<HTMLInputElement>(`.${CHECKBOX_CLASS}`);
		if (box) box.checked = true;
	}

	private onClick(evt: MouseEvent): void {
		const target = targetOf(evt);
		const rowEl = target?.closest<HTMLElement>('.princelists-start-step');
		if (!target || !rowEl) return;
		if (target.instanceOf(HTMLInputElement)) {
			rowEl.toggleClass('is-done', target.checked);
			return;
		}
		if (!target.closest('.princelists-start-button')) return;
		if (rowEl.dataset.step === 'make-list') this.actions.createList();
		else if (rowEl.dataset.step === 'open-schedule') void openSchedule(this.app.workspace);
	}
}
