import { Modal, type App } from 'obsidian';

/**
 * The repeat form on mobile, in Obsidian's own modal instead of hung from the card's buttons, where
 * the keyboard covers it and a scroll closes it (repeating items' design, "Setting a repeat").
 * `fill` builds the form in the modal's content as it opens, and `closed` runs however it closes:
 * Save, Remove repeat, its close button, a tap outside it, or Back.
 */
export class RepeatModal extends Modal {
	constructor(
		app: App,
		private readonly fill: (contentEl: HTMLElement) => void,
		private readonly closed: () => void,
	) {
		super(app);
	}

	override onOpen(): void {
		this.setTitle('Repeat');
		this.fill(this.contentEl);
	}

	override onClose(): void {
		this.contentEl.empty();
		this.closed();
	}
}
