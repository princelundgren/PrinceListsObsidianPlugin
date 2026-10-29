import { type App, FileView, Notice, type TFile, TextFileView } from 'obsidian';
import { isMarkerValue } from '../core/frontmatter';
import { applyMarkerEdit, planUnmark, type UnmarkRefusal } from '../core/marker-edit';
import { contentStartLine, isListText } from './marker';

type Outcome = 'written' | 'already-a-note' | UnmarkRefusal;

const REFUSAL_NOTICES: Record<UnmarkRefusal['refused'], string> = {
	'not-found': "The note's princelists property isn't on a line of its own, so it wasn't turned into a note.",
	'multiline-value': "The note's princelists property runs over several lines, so it wasn't turned into a note.",
};

export function canTurnIntoNote(app: App, file: TFile): boolean {
	if (file.extension !== 'md' || file.parent === null) return false;
	return isMarkerValue(app.metadataCache.getFileCache(file)?.frontmatter);
}

// A tab showing the list as a list switches to Markdown by itself once the marker is gone (spec,
// "If the marker is gone in setViewData"); otherwise the note opens as Markdown.
export async function turnIntoNote(app: App, file: TFile): Promise<void> {
	const showing = viewsShowing(app, file);
	let outcome: Outcome;
	try {
		// Typing not yet saved, in an editor or a list, goes to disk first.
		for (const view of showing) if (view instanceof TextFileView) await view.save();
		outcome = await writeThroughVault(app, file);
	} catch (error) {
		console.error(`PrinceLists: could not turn ${file.path} into a note`, error);
		new Notice(`Couldn't turn ${file.basename} into a note.`);
		return;
	}
	if (outcome !== 'written' && outcome !== 'already-a-note') {
		new Notice(REFUSAL_NOTICES[outcome.refused]);
		return;
	}
	if (showing.length === 0) await app.workspace.getLeaf(false).openFile(file);
}

function viewsShowing(app: App, file: TFile): FileView[] {
	const views: FileView[] = [];
	app.workspace.iterateAllLeaves((leaf) => {
		if (leaf.view instanceof FileView && leaf.view.file === file) views.push(leaf.view);
	});
	return views;
}

async function writeThroughVault(app: App, file: TFile): Promise<Outcome> {
	let outcome: Outcome = 'written';
	await app.vault.process(file, (text) => {
		const plan = isListText(text) ? planUnmark(text, contentStartLine(text) - 1) : null;
		if (!plan || 'refused' in plan) {
			outcome = plan ?? 'already-a-note';
			return text;
		}
		return applyMarkerEdit(text, plan);
	});
	return outcome;
}
