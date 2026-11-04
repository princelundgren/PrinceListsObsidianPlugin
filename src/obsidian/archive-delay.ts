import { type EventRef, Events } from 'obsidian';

/** The archive delay the settings hold, which the views read on each redraw, and tells them when it changes. */
export class ArchiveDelay extends Events {
	constructor(private readonly read: () => number) {
		super();
	}

	/** How long after its tick a done item is archived, in milliseconds. */
	get ms(): number {
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
