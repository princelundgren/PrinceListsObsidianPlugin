import { MarkdownView, type Plugin, type TFile, type WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE_LIST, VIEW_TYPE_MARKDOWN } from '../constants';
import { isListText } from './marker';

// Panes where the user chose "Open as Markdown". The choice holds until the pane is switched back
// or Obsidian restarts.
const markdownChosen = new WeakSet<WorkspaceLeaf>();

// Switches on `file-open`, not `active-leaf-change`: that fires on every file load in the active
// leaf, so it would push a pane straight back after "Open as Markdown".
export function registerAutoSwitch(plugin: Plugin): void {
	const { workspace } = plugin.app;
	plugin.registerEvent(
		workspace.on('file-open', (file) => {
			// `file-open` also fires for embeds, canvas nodes and keyboard navigation in the file
			// explorer, so only the active Markdown view showing this very file counts.
			const view = workspace.getActiveViewOfType(MarkdownView);
			if (!file || !view || view.file !== file) return;
			// `data` holds the text the view has just loaded, as the file is newly opened.
			if (markdownChosen.has(view.leaf) || !isListText(view.data)) return;
			void openAsList(view.leaf, file);
		}),
	);
}

// Through setViewState, never openFile: Markdown is the view `.md` files open in.
// Both update markdownChosen before awaiting setViewState, because `file-open` can fire during the
// switch.
export async function openAsList(leaf: WorkspaceLeaf, file: TFile): Promise<void> {
	markdownChosen.delete(leaf);
	await leaf.setViewState({ type: VIEW_TYPE_LIST, state: { file: file.path } });
}

export async function openAsMarkdown(leaf: WorkspaceLeaf, file: TFile): Promise<void> {
	markdownChosen.add(leaf);
	await leaf.setViewState({ type: VIEW_TYPE_MARKDOWN, state: { file: file.path } });
}
