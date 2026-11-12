import { Modal, Setting, type App } from 'obsidian';
import { whenClick } from './card-when';

/**
 * Asks for a date with the platform's own date picker, which opens when the user clicks or taps the
 * input, then hands the chosen day (YYYY-MM-DD) to `onSet`. Set, or Enter in the input, sets it;
 * Cancel, or Set with no date, sets none.
 */
export class DateModal extends Modal {
	private input: HTMLInputElement | null = null;

	constructor(
		app: App,
		private readonly onSet: (day: string) => void,
	) {
		super(app);
		// Only in the input: Enter on Cancel still cancels.
		this.scope.register([], 'Enter', (evt) => {
			if (this.input === null || evt.target !== this.input) return true;
			this.set();
			return false;
		});
	}

	override onOpen(): void {
		this.setTitle('Set date');
		const input = this.contentEl.createEl('input', { type: 'date', attr: { 'aria-label': 'Date' } });
		this.input = input;
		// The modal's own element, which closing it removes with the listener.
		input.addEventListener('click', () => whenClick(input));
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText('Cancel').onClick(() => this.close()))
			.addButton((button) =>
				button
					.setButtonText('Set')
					.setCta()
					.onClick(() => this.set()),
			);
	}

	override onClose(): void {
		this.contentEl.empty();
		this.input = null;
	}

	private set(): void {
		const day = this.input?.value;
		this.close();
		if (day) this.onSet(day);
	}
}
