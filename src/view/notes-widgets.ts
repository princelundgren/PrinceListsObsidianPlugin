import { WidgetType } from '@codemirror/view';
import type { Component } from 'obsidian';
import type { PictureLook } from '../core/drawn-links';
import type { PrinceListView } from './list-view';
import { renderNotes } from './notes';

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

/** A picture from the vault at `src`, with the alt text and size its Markdown gives. */
export class PictureWidget extends WidgetType {
	constructor(
		readonly src: string,
		readonly look: PictureLook,
	) {
		super();
	}

	eq(other: PictureWidget): boolean {
		return other.src === this.src && other.look.alt === this.look.alt && other.look.size === this.look.size;
	}

	toDOM(): HTMLElement {
		const img = createEl('img', { cls: 'princelists-notes-picture', attr: { src: this.src } });
		if (this.look.alt !== null) img.setAttr('alt', this.look.alt);
		const [width, height] = this.look.size?.split('x') ?? [];
		if (width) img.setAttr('width', width);
		if (height) img.setAttr('height', height);
		return img;
	}
}

/** A picture from the web, drawn from its Markdown by Obsidian's renderer, as in a note. */
export class WebPictureWidget extends WidgetType {
	constructor(
		readonly markdown: string,
		private readonly view: PrinceListView,
		private readonly sourcePath: string,
	) {
		super();
	}

	eq(other: WebPictureWidget): boolean {
		return other.markdown === this.markdown;
	}

	toDOM(): HTMLElement {
		const el = createSpan({ cls: 'princelists-notes-web-picture' });
		renderedPictures.set(el, renderNotes(this.view, this.sourcePath, el, this.markdown));
		return el;
	}

	destroy(dom: HTMLElement): void {
		const component = renderedPictures.get(dom);
		if (component) this.view.removeChild(component);
	}
}

// By element, since CodeMirror keeps the element of a widget that an equal one replaces.
const renderedPictures = new WeakMap<HTMLElement, Component>();
