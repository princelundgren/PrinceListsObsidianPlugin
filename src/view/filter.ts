import { prepareFuzzySearch, SearchComponent, setIcon, setTooltip, type App, type Component, type Debouncer, type Menu, type WorkspaceLeaf } from 'obsidian';
import type { Find } from '../core/display';

export const FILTER_CLASS = 'princelists-filter';

/** The filter icon where a view's header can't hold it: the Schedule's, beside its title. */
export const FIND_BUTTON_CLASS = 'princelists-find-button';

/** A list's show-archived toggle, at the end of the field's row. */
export const ARCHIVED_TOGGLE_CLASS = 'princelists-archived-toggle';

/** The show-starred-only toggle, in the field's row of a list and of the Schedule. */
export const STARRED_TOGGLE_CLASS = 'princelists-starred-toggle';

/**
 * The toggles in the field's row. A press on one mustn't take focus from the field, which would put
 * a phone's keyboard away, so a view prevents the default of a mousedown on them.
 */
export const FILTER_TOGGLE_SELECTOR = `.${STARRED_TOGGLE_CLASS}, .${ARCHIVED_TOGGLE_CLASS}`;

/** Cmd+F's field, in a row with its starred toggle, and in a list its archived toggle. */
export interface FilterField {
	rowEl: HTMLElement;
	inputEl: HTMLInputElement;
}

/** What a list or the Schedule shows while a filter is on and no item matches it. */
export const NO_MATCH_HINT = 'No items match';
export const NO_MATCH_CLASS = 'princelists-no-match';

/** How long typing in Cmd+F's field pauses before the rows are drawn again. */
export const FILTER_PAUSE_MS = 100;

/** A view Cmd+F filters: a list or the Schedule. */
export interface FilterHost {
	/** Cmd+F's query, or null while its field is closed. */
	filter: string | null;
	filterField: FilterField | null;
	/** "Show starred only": on only while the field is open, so its star toggle always shows it. */
	starredOnly: boolean;
	readonly app: App;
	readonly leaf: WorkspaceLeaf;
	/** Draws the view again, with the field while `filter` isn't null. */
	render(): void;
	/** `render`, once typing pauses for FILTER_PAUSE_MS. */
	readonly redrawFiltered: Debouncer<[], void>;
	/** Puts back what the field's row changed, before the view is drawn without it. */
	filterClosed?(): void;
}

/**
 * What `query` finds, with Obsidian's fuzzy search for words: its letters in order, with gaps,
 * ignoring case and accents. Spaces around it are ignored, and null for no text, which filters nothing.
 */
export function findOf(query: string): Find | null {
	const text = query.trim();
	if (text === '') return null;
	const search = prepareFuzzySearch(text);
	return { text, fuzzyMatches: (shown) => search(shown) !== null };
}

/** The icon that opens and closes the field. */
export const FILTER_ICON = 'list-filter';

/** Shows a filter icon pressed while the field is open. */
export function syncFilterButton(button: HTMLElement, view: FilterHost): void {
	button.toggleClass('princelists-filter-open', view.filter !== null);
	button.setAttribute('aria-pressed', String(view.filter !== null));
}

// Cmd+F or "Filter list" (spec, "Cmd+F"). The query lives on the view, not in its state, so a view
// always opens unfiltered.
export function openFilter(view: FilterHost): void {
	if (view.filter === null) {
		view.filter = '';
		view.render();
	}
	view.filterField?.inputEl.focus();
	view.filterField?.inputEl.select();
}

/** Obsidian's search field, whose clear button empties it as typing does, filtering `view` as it changes. */
export function buildFilterField(view: FilterHost, parent: HTMLElement, placeholder: string): FilterField {
	const rowEl = parent.createDiv({ cls: 'princelists-filter-row' });
	const search = new SearchComponent(rowEl.createDiv({ cls: FILTER_CLASS }))
		.setPlaceholder(placeholder)
		.setValue(view.filter ?? '')
		.onChange((value) => filterInput(view, value));
	return { rowEl, inputEl: search.inputEl };
}

export function addStarredToggle(field: FilterField): void {
	const button = field.rowEl.createEl('button', { cls: STARRED_TOGGLE_CLASS });
	setIcon(button, 'star');
	setTooltip(button, 'Show starred only');
}

/** Lights the field's starred toggle while only starred items show. */
export function syncStarredToggle(field: FilterField | null, starredOnly: boolean): void {
	const button = field?.rowEl.querySelector<HTMLElement>(`.${STARRED_TOGGLE_CLASS}`);
	button?.toggleClass('princelists-starred-only', starredOnly);
	button?.setAttribute('aria-pressed', String(starredOnly));
}

/**
 * Turns "Show starred only" on or off. Turned on from a menu with the field closed, it opens the
 * field without focusing it, so the lit toggle shows why items are hidden.
 */
export function toggleStarredOnly(view: FilterHost): void {
	view.starredOnly = !view.starredOnly;
	if (view.starredOnly && view.filter === null) view.filter = '';
	view.render();
}

/** The pane menu's "Show starred only", checked while it's on. */
export function addStarredOnlyItem(menu: Menu, starredOnly: boolean, toggle: () => void): void {
	menu.addItem((item) => item.setTitle('Show starred only').setIcon('star').setChecked(starredOnly).onClick(toggle));
}

export function addArchivedToggle(field: FilterField): void {
	setIcon(field.rowEl.createEl('button', { cls: ARCHIVED_TOGGLE_CLASS }), 'square-check-big');
}

/** The filter icon's press: opens the field, or closes it and shows every row again. */
export function toggleFilter(view: FilterHost): void {
	if (view.filter === null) openFilter(view);
	else closeFilter(view);
}

/** Listens on `el`, the view's own element, for Escape in the field. */
export function registerFilterEvents(view: FilterHost & Component, el: HTMLElement): void {
	view.registerDomEvent(el, 'keydown', (evt) => {
		if (evt.target === view.filterField?.inputEl && !evt.isComposing) filterKeyDown(view, evt);
	});
}

function filterInput(view: FilterHost, value: string): void {
	view.filter = value;
	if (view.filter === '') view.render();
	else view.redrawFiltered();
}

export function filterKeyDown(view: FilterHost, evt: KeyboardEvent): void {
	if (evt.key !== 'Escape') return;
	evt.preventDefault();
	closeFilter(view);
	// The field held focus and is gone, so the view's own keys would stop working without this.
	view.app.workspace.setActiveLeaf(view.leaf, { focus: true });
}

/** Takes the field's row out of the view, leaving `filter` as it is. */
export function removeFilterField(view: FilterHost): void {
	view.filterField?.rowEl.remove();
	view.filterField = null;
}

function closeFilter(view: FilterHost): void {
	view.filter = null;
	view.starredOnly = false;
	view.filterClosed?.();
	view.render();
}
