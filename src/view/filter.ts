import { setIcon, type App, type Component, type Debouncer, type WorkspaceLeaf } from 'obsidian';

export const FILTER_CLASS = 'princelists-filter';

/** The search icon that opens the field where a view's header can't hold it: the Schedule's, beside its title. */
export const FIND_BUTTON_CLASS = 'princelists-find-button';

/** A list's show-archived toggle, at the end of the field's row. */
export const ARCHIVED_TOGGLE_CLASS = 'princelists-archived-toggle';

/** Cmd+F's field, in a row that a list also gives its archived toggle. */
export interface FilterField {
	rowEl: HTMLElement;
	inputEl: HTMLInputElement;
}

/** How long typing in Cmd+F's field pauses before the rows are drawn again. */
export const FILTER_PAUSE_MS = 100;

/** A view Cmd+F filters: a list or the Schedule. */
export interface FilterHost {
	/** Cmd+F's query, or null while its field is closed. */
	filter: string | null;
	filterField: FilterField | null;
	readonly app: App;
	readonly leaf: WorkspaceLeaf;
	/** Draws the view again, with the field while `filter` isn't null. */
	render(): void;
	/** `render`, once typing pauses for FILTER_PAUSE_MS. */
	readonly redrawFiltered: Debouncer<[], void>;
}

// Cmd+F or "Find in list" (spec, "Cmd+F"). The query lives on the view, not in its state, so a view
// always opens unfiltered.
export function openFilter(view: FilterHost): void {
	if (view.filter === null) {
		view.filter = '';
		view.render();
	}
	view.filterField?.inputEl.focus();
	view.filterField?.inputEl.select();
}

export function buildFilterField(parent: HTMLElement, query: string, placeholder: string): FilterField {
	const rowEl = parent.createDiv({ cls: 'princelists-filter-row' });
	const inputEl = rowEl.createEl('input', {
		cls: FILTER_CLASS,
		type: 'search',
		value: query,
		attr: { placeholder },
	});
	return { rowEl, inputEl };
}

// Out of the tab order and kept from taking focus on a press (the view's mousedown listener), so an
// empty field stays open under it; Cmd+Shift+A is the keyboard's way.
export function addArchivedToggle(field: FilterField): void {
	const toggle = field.rowEl.createEl('button', { cls: ARCHIVED_TOGGLE_CLASS, attr: { tabindex: '-1' } });
	setIcon(toggle, 'square-check-big');
}

/** Listens on `el`, the view's own element, for typing, Escape and leaving in the find field. */
export function registerFilterEvents(view: FilterHost & Component, el: HTMLElement): void {
	const isField = (evt: Event): boolean => evt.target === view.filterField?.inputEl;
	view.registerDomEvent(el, 'input', (evt) => {
		if (isField(evt)) filterInput(view);
	});
	view.registerDomEvent(el, 'keydown', (evt) => {
		if (isField(evt) && !evt.isComposing) filterKeyDown(view, evt);
	});
	view.registerDomEvent(el, 'focusout', (evt) => {
		if (isField(evt)) filterBlur(view);
	});
}

export function filterInput(view: FilterHost): void {
	view.filter = view.filterField?.inputEl.value ?? '';
	// At once when emptied, so the rows are all back before a click can move focus away (filterBlur).
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

// An empty field closes once the cursor leaves it; one with a query stays, so the rows stay filtered.
// An empty query already shows every row, so only the field goes: rows drawn again under a click
// that moved focus here could lose that click.
export function filterBlur(view: FilterHost): void {
	if (view.filter !== '') return;
	view.filter = null;
	removeFilterField(view);
}

/** Takes the field's row out of the view, leaving `filter` as it is. */
export function removeFilterField(view: FilterHost): void {
	view.filterField?.rowEl.remove();
	view.filterField = null;
}

function closeFilter(view: FilterHost): void {
	view.filter = null;
	view.render();
}
