import type { PrinceListView } from './list-view';

export const FILTER_CLASS = 'princelists-filter';

// Cmd+F or "Find in list" (spec, "Cmd+F"). The query lives on the view, not in its state, so a list
// always opens unfiltered.
export function openFilter(view: PrinceListView): void {
	if (view.filter === null) {
		view.filter = '';
		view.render();
	}
	view.filterEl?.focus();
	view.filterEl?.select();
}

export function buildFilterField(view: PrinceListView, parent: HTMLElement): HTMLInputElement {
	return parent.createEl('input', {
		cls: FILTER_CLASS,
		type: 'search',
		value: view.filter ?? '',
		attr: { placeholder: 'Find in list' },
	});
}

export function filterInput(view: PrinceListView): void {
	view.filter = view.filterEl?.value ?? '';
	view.render();
}

export function filterKeyDown(view: PrinceListView, evt: KeyboardEvent): void {
	if (evt.key !== 'Escape') return;
	evt.preventDefault();
	closeFilter(view);
	// The field held focus and is gone, so the list's own keys would stop working without this.
	view.app.workspace.setActiveLeaf(view.leaf, { focus: true });
}

// An empty field closes once the cursor leaves it; one with a query stays, so the rows stay filtered.
// An empty query already shows every row, so only the field goes: rows drawn again under a click
// that moved focus here could lose that click.
export function filterBlur(view: PrinceListView): void {
	if (view.filter !== '') return;
	view.filter = null;
	view.filterEl?.remove();
	view.filterEl = null;
}

function closeFilter(view: PrinceListView): void {
	view.filter = null;
	view.render();
}
