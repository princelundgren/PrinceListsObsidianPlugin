import { normalizePath, type App, type TFile, type TFolder } from 'obsidian';
import { MARKER_KEY } from '../constants';
import { nextUntitledName } from '../core/untitled';
import { PrinceListView } from '../view/list-view';
import { openAsList } from './switch';

export async function createList(app: App, folder: TFolder): Promise<TFile> {
	const taken = new Set(folder.children.map((child) => child.name));
	const path = normalizePath(`${folder.path}/${nextUntitledName(taken)}.md`);
	return app.vault.create(path, `---\n${MARKER_KEY}: true\n---\n`);
}

export async function openNewList(app: App, file: TFile): Promise<void> {
	const leaf = app.workspace.getLeaf('tab');
	await openAsList(leaf, file);
	if (leaf.view instanceof PrinceListView) leaf.view.focusListTitle();
}
