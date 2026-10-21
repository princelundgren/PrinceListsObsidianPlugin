import { MarkdownView, type Plugin, type TFile, type Workspace, type WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE_LIST, VIEW_TYPE_MARKDOWN } from '../constants';
import { isListText } from './marker';

// The paths of the notes each pane was told to "Open as Markdown". A choice holds for that note in
// that pane, so another list opened there still shows as a list, until the note is switched back
// or Obsidian restarts.
const markdownChosen = new WeakMap<WorkspaceLeaf, Set<string>>();

function choseMarkdown(leaf: WorkspaceLeaf, file: TFile): boolean {
	return markdownChosen.get(leaf)?.has(file.path) ?? false;
}

// The same check runs on `file-open` and `active-leaf-change`, and the first event that finds the
// view's text loaded switches: a switch made while the leaf is still loading is ignored. A note
// opened in the same tab is loaded by `file-open`. A new tab fires `active-leaf-change` once before
// its text loads and once after (observed in 1.14.4). `active-leaf-change` fires on every file load
// in the active leaf, so markdownChosen is what keeps it from pushing a pane straight back after
// "Open as Markdown".
export function registerAutoSwitch(plugin: Plugin): void {
	const { workspace } = plugin.app;
	plugin.registerEvent(
		workspace.on('file-open', (file) => {
			// `file-open` also fires for embeds, canvas nodes and keyboard navigation in the file
			// explorer, so only the active Markdown view showing this very file counts.
			if (file && workspace.getActiveViewOfType(MarkdownView)?.file === file) {
				switchActiveIfList(workspace);
			}
		}),
	);
	plugin.registerEvent(workspace.on('active-leaf-change', () => switchActiveIfList(workspace)));
}

function switchActiveIfList(workspace: Workspace): void {
	const view = workspace.getActiveViewOfType(MarkdownView);
	// `data` is unset until the text loads (observed). A later event decides then.
	if (!view?.file || !view.data || choseMarkdown(view.leaf, view.file) || !isListText(view.data)) return;
	void openAsList(view.leaf, view.file);
}

// Through setViewState, never openFile: Markdown is the view `.md` files open in.
// Both update markdownChosen before awaiting setViewState, because `file-open` and
// `active-leaf-change` can fire during the switch.
export async function openAsList(leaf: WorkspaceLeaf, file: TFile): Promise<void> {
	markdownChosen.get(leaf)?.delete(file.path);
	await leaf.setViewState({ type: VIEW_TYPE_LIST, state: { file: file.path } });
}

export async function openAsMarkdown(leaf: WorkspaceLeaf, file: TFile): Promise<void> {
	const paths = markdownChosen.get(leaf) ?? new Set<string>();
	markdownChosen.set(leaf, paths.add(file.path));
	await leaf.setViewState({ type: VIEW_TYPE_MARKDOWN, state: { file: file.path } });
}
