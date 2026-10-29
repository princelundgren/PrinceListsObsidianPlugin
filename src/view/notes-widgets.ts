import { WidgetType } from '@codemirror/view';

/** A list item's `-`, `*` or `+`, drawn as a bullet. */
export class BulletWidget extends WidgetType {
	eq(): boolean {
		return true;
	}

	toDOM(): HTMLElement {
		return createSpan({ cls: 'princelists-notes-bullet' });
	}
}

/** A horizontal rule's Markdown, drawn as a rule across the line. */
export class RuleWidget extends WidgetType {
	eq(): boolean {
		return true;
	}

	toDOM(): HTMLElement {
		return createEl('hr', { cls: 'princelists-notes-rule-line' });
	}
}

/** A picture from the vault at `src`; `size` is `width` or `widthxheight` in pixels, or null for its own. */
export class PictureWidget extends WidgetType {
	constructor(
		readonly src: string,
		readonly size: string | null,
	) {
		super();
	}

	eq(other: PictureWidget): boolean {
		return other.src === this.src && other.size === this.size;
	}

	toDOM(): HTMLElement {
		const img = createEl('img', { cls: 'princelists-notes-picture', attr: { src: this.src } });
		const [width, height] = this.size?.split('x') ?? [];
		if (width) img.setAttr('width', width);
		if (height) img.setAttr('height', height);
		return img;
	}
}
