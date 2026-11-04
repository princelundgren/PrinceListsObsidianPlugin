import type { App, Workspace } from 'obsidian';
import { VIEW_TYPE_GETTING_STARTED } from '../constants';
import { isMarkerValue } from '../core/frontmatter';

/** Shows the Getting started tab where it is open, else opens it in a new tab, and makes it active. */
export async function openGettingStarted(workspace: Workspace): Promise<void> {
	const open = workspace.getLeavesOfType(VIEW_TYPE_GETTING_STARTED)[0];
	const leaf = open ?? workspace.getLeaf('tab');
	if (!open) await leaf.setViewState({ type: VIEW_TYPE_GETTING_STARTED, active: true });
	await workspace.revealLeaf(leaf);
	workspace.setActiveLeaf(leaf, { focus: true });
}

/** The paths of the notes that are lists, as the metadata cache has read them. */
export function listPaths(app: App): string[] {
	return app.vault
		.getMarkdownFiles()
		.filter((file) => isMarkerValue(app.metadataCache.getFileCache(file)?.frontmatter))
		.map((file) => file.path);
}

/** Whether any note in the vault is a list, as the metadata cache has read it. */
export function vaultHasLists(app: App): boolean {
	return listPaths(app).length > 0;
}
