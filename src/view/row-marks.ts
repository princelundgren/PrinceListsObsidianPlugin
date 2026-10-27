import { setIcon } from 'obsidian';

export function addStar(rowEl: HTMLElement): void {
	setIcon(rowEl.createSpan({ cls: 'princelists-star' }), 'star');
}
