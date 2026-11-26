import { type EventRef, Events } from 'obsidian';
import type { OverdueStyle } from '../core/overdue';

/** How the settings show an overdue item's day, which the views read on each redraw, and tells them when it changes. */
export class OverdueLook extends Events {
	constructor(private readonly read: () => OverdueStyle) {
		super();
	}

	get style(): OverdueStyle {
		return this.read();
	}

	/** Notifies the listeners registered with `onChange`. */
	changed(): void {
		this.trigger('change');
	}

	/** Pass the result to `registerEvent`, so the listener goes when its view does. */
	onChange(callback: () => void): EventRef {
		return this.on('change', callback);
	}
}
