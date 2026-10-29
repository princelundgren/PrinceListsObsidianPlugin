import type { WidgetType } from '@codemirror/view';
import { getLinkpath } from 'obsidian';
import type { PictureLook } from '../core/drawn-links';
import type { PrinceListView } from './list-view';
import { PictureWidget, WebPictureWidget } from './notes-widgets';

/** What the notes drawing needs from Obsidian, with links resolved as in one note. */
export interface NotesLinks {
	/** A picture from the vault, or null when no file has that path. */
	picture(linkpath: string, look: PictureLook): WidgetType | null;
	/** A picture from the web, which Obsidian's renderer draws from its Markdown. */
	webPicture(markdown: string): WidgetType;
	isResolved(linktext: string): boolean;
}

/** The links of the note at `sourcePath`, whose drawn web pictures are children of `view`. */
export function notesLinks(view: PrinceListView, sourcePath: string): NotesLinks {
	const { metadataCache, vault } = view.app;
	return {
		picture: (linkpath, look) => {
			const file = metadataCache.getFirstLinkpathDest(linkpath, sourcePath);
			return file ? new PictureWidget(vault.getResourcePath(file), look) : null;
		},
		webPicture: (markdown) => new WebPictureWidget(markdown, view, sourcePath),
		// A link to a heading in the same note, `[[#h]]`, has no path.
		isResolved: (linktext) => {
			const linkpath = getLinkpath(linktext);
			return linkpath === '' || metadataCache.getFirstLinkpathDest(linkpath, sourcePath) !== null;
		},
	};
}
