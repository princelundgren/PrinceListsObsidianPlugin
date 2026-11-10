import { Modal, Setting, type App } from 'obsidian';
import { whenClick } from './card-when';

/**
 * Asks for a date with the platform's own date picker, which opens when the user clicks or taps the
 * input, then hands the chosen day (YYYY-MM-DD) to `onSet`. Cancel, or Set with no date, sets none.
 */
export class DateModal extends Modal {
	constructor(
		app: App,
		private readonly onSet: (day: string) => void,
	) {
		super(app);
	}

	override onOpen(): void {
		this.setTitle('Set date');
		const input = this.contentEl.createEl('input', { type: 'date', attr: { 'aria-label': 'Date' } });
		// The modal's own element, which closing it removes with the listener.
		input.addEventListener('click', () => whenClick(input));
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText('Cancel').onClick(() => this.close()))
			.addButton((button) =>
				button
					.setButtonText('Set')
					.setCta()
					.onClick(() => {
						this.close();
						if (input.value) this.onSet(input.value);
					}),
			);
	}

	override onClose(): void {
		this.contentEl.empty();
	}
}
