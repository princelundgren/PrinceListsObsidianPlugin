import { type App, type EventRef, MarkdownView, Notice, type Plugin, type TFile, type WorkspaceLeaf } from 'obsidian';
import { isMarkerValue } from '../core/frontmatter';
import { applyMarkerEdit, type MarkerRefusal, planMarker } from '../core/marker-edit';
import { isListText, readFrontmatter } from './marker';
import { openAsList } from './switch';

type Outcome = 'written' | 'already-a-list' | MarkerRefusal;

const REFUSAL_NOTICES: Record<MarkerRefusal['refused'], string> = {
	'not-a-mapping': "The note's properties can't be read, so it wasn't turned into a list.",
	'multiline-value': "The note's princelists property runs over several lines, so it wasn't turned into a list.",
};

// Only one wait is kept: a newer "Turn into list" ends the one before it. Its listeners aren't given
// to registerEvent, which would keep every ref until unload, so the plugin ends it on unload.
let endWait: (() => void) | null = null;

export function endTurnIntoListWait(): void {
	endWait?.();
}

// A note outside the vault has no parent (observed in 1.14.4); `TExternalFile` is newer than
// minAppVersion, and getAbstractFileByPath returns such a note under its `file:` path.
export function canTurnIntoList(app: App, file: TFile): boolean {
	if (file.extension !== 'md' || file.parent === null) return false;
	return !isMarkerValue(app.metadataCache.getFileCache(file)?.frontmatter);
}

export async function turnIntoList(plugin: Plugin, file: TFile): Promise<void> {
	const view = markdownViewShowing(plugin.app, file);
	const leaf = view?.leaf ?? plugin.app.workspace.getLeaf(false);
	waitForMarker(plugin, file, leaf);
	let outcome: Outcome;
	try {
		// Typing not yet saved goes to disk first. Obsidian drops an editor edit inside the
		// frontmatter while it shows the properties, so the marker never goes in through the editor.
		await view?.save();
		outcome = await writeThroughVault(plugin.app, file);
	} catch (error) {
		endWait?.();
		console.error(`PrinceLists: could not turn ${file.path} into a list`, error);
		new Notice(`Couldn't turn ${file.basename} into a list.`);
		return;
	}
	if (outcome === 'written') return;
	endWait?.();
	if (outcome === 'already-a-list') await openAsList(leaf, file);
	else new Notice(REFUSAL_NOTICES[outcome.refused]);
}

function markdownViewShowing(app: App, file: TFile): MarkdownView | null {
	const active = app.workspace.getActiveViewOfType(MarkdownView);
	if (active?.file === file) return active;
	for (const leaf of app.workspace.getLeavesOfType('markdown')) {
		if (leaf.view instanceof MarkdownView && leaf.view.file === file) return leaf.view;
	}
	return null;
}

function planFor(text: string) {
	return isListText(text) ? ('already-a-list' as const) : planMarker(text, readFrontmatter(text));
}

async function writeThroughVault(app: App, file: TFile): Promise<Outcome> {
	let outcome: Outcome = 'written';
	await app.vault.process(file, (text) => {
		const plan = planFor(text);
		if (plan === 'already-a-list' || 'refused' in plan) {
			outcome = plan;
			return text;
		}
		return applyMarkerEdit(text, plan);
	});
	return outcome;
}

// The note opens once the metadata cache has read the marker, from the text it was built from. An
// event without the marker may come from an earlier save, so it is ignored.
function waitForMarker(plugin: Plugin, file: TFile, leaf: WorkspaceLeaf): void {
	endWait?.();
	const { metadataCache, vault } = plugin.app;
	const refs: [{ offref(ref: EventRef): void }, EventRef][] = [];
	const end = () => {
		for (const [source, ref] of refs) source.offref(ref);
		if (endWait === end) endWait = null;
	};
	const listen = (source: { offref(ref: EventRef): void }, ref: EventRef) => {
		refs.push([source, ref]);
	};
	listen(
		metadataCache,
		metadataCache.on('changed', (changed, data) => {
			if (changed !== file || !isListText(data)) return;
			end();
			void openAsList(leaf, file);
		}),
	);
	listen(vault, vault.on('delete', (deleted) => deleted === file && end()));
	listen(vault, vault.on('rename', (renamed) => renamed === file && end()));
	endWait = end;
}
