import { setIcon, type App, type Component, type Debouncer, type WorkspaceLeaf } from 'obsidian';

export const FILTER_CLASS = 'princelists-filter';

/** The filter icon where a view's header can't hold it: the Schedule's, beside its title. */
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
	/** Puts back what the field's row changed, before the view is drawn without it. */
	filterClosed?(): void;
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

export function addArchivedToggle(field: FilterField): void {
	setIcon(field.rowEl.createEl('button', { cls: ARCHIVED_TOGGLE_CLASS }), 'square-check-big');
}

/** The filter icon's press: opens the field, or closes it and shows every row again. */
export function toggleFilter(view: FilterHost): void {
	if (view.filter === null) openFilter(view);
	else closeFilter(view);
}

/** Listens on `el`, the view's own element, for typing and Escape in the field. */
export function registerFilterEvents(view: FilterHost & Component, el: HTMLElement): void {
	const isField = (evt: Event): boolean => evt.target === view.filterField?.inputEl;
	view.registerDomEvent(el, 'input', (evt) => {
		if (isField(evt)) filterInput(view);
	});
	view.registerDomEvent(el, 'keydown', (evt) => {
		if (isField(evt) && !evt.isComposing) filterKeyDown(view, evt);
	});
}

export function filterInput(view: FilterHost): void {
	view.filter = view.filterField?.inputEl.value ?? '';
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
	view.filterClosed?.();
	view.render();
}
