import type { App, Debouncer, WorkspaceLeaf } from 'obsidian';

export const FILTER_CLASS = 'princelists-filter';

/** How long typing in Cmd+F's field pauses before the rows are drawn again. */
export const FILTER_PAUSE_MS = 100;

/** A view Cmd+F filters: a list or the Schedule. */
export interface FilterHost {
	/** Cmd+F's query, or null while its field is closed. */
	filter: string | null;
	filterEl: HTMLInputElement | null;
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
	view.filterEl?.focus();
	view.filterEl?.select();
}

export function buildFilterField(parent: HTMLElement, query: string, placeholder: string): HTMLInputElement {
	return parent.createEl('input', {
		cls: FILTER_CLASS,
		type: 'search',
		value: query,
		attr: { placeholder },
	});
}

export function filterInput(view: FilterHost): void {
	view.filter = view.filterEl?.value ?? '';
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
	view.filterEl?.remove();
	view.filterEl = null;
}

function closeFilter(view: FilterHost): void {
	view.filter = null;
	view.render();
}
