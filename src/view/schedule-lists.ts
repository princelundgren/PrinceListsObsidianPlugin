import { TFile, type CachedMetadata, type TAbstractFile } from 'obsidian';
import { isMarkerValue } from '../core/frontmatter';
import { datedItems, type ScheduledItem } from '../core/schedule';
import { contentStartLine, listTags } from '../obsidian/marker';
import type { ScheduleView } from './schedule-view';

/** A list as the view last read it: a tick is worked out on that text. */
export interface ReadList {
	text: string;
	items: ScheduledItem[];
}

/** Follows the metadata cache: a changed list is read again, a note that stopped being one is dropped. */
export function listChanged(view: ScheduleView, file: TFile, text: string, cache: CachedMetadata): void {
	if (isList(cache)) listRead(view, file, text);
	else listDeleted(view, file.path);
}

/** Takes `text` as the list's current text and draws again. */
export function listRead(view: ScheduleView, file: TFile, text: string): void {
	view.updatedPaths?.add(file.path);
	view.lists.set(file.path, readList(file, text));
	view.draw();
}

/** Moves a list's items to its new path, or drops them when the file is no longer a list. */
export async function listRenamed(view: ScheduleView, file: TAbstractFile, oldPath: string): Promise<void> {
	view.updatedPaths?.add(oldPath).add(file.path);
	const wasList = view.lists.delete(oldPath);
	if (file instanceof TFile && isList(view.app.metadataCache.getFileCache(file))) {
		view.lists.set(file.path, readList(file, await view.app.vault.cachedRead(file)));
	} else if (!wasList) {
		return;
	}
	view.draw();
}

/** Drops a list's items and what the view remembers of its failed comebacks. */
export function listDeleted(view: ScheduleView, path: string): void {
	view.updatedPaths?.add(path);
	view.comeBackFailedOn.delete(path);
	if (view.lists.delete(path)) view.draw();
}

/** Whether a note's cached metadata marks it as a list. */
export function isList(cache: CachedMetadata | null): boolean {
	return isMarkerValue(cache?.frontmatter);
}

/** Reads a list's dated items from its text. */
export function readList(file: TFile, text: string): ReadList {
	return { text, items: datedItems(text, contentStartLine(text), { path: file.path, name: file.basename, tags: listTags(text) }) };
}
