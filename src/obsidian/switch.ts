import { MarkdownView, type Plugin, type TFile, type Workspace, type WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE_LIST, VIEW_TYPE_MARKDOWN } from '../constants';
import { isListText } from './marker';

// The notes each pane was told to "Open as Markdown". A choice holds for that note in that pane, so
// another list opened there still shows as a list, until the note is switched back or Obsidian
// restarts. Keyed by the TFile, not its path, so a rename or move keeps the choice: the vault's
// `rename` event passes that same file with its new path.
const markdownChosen = new WeakMap<WorkspaceLeaf, WeakSet<TFile>>();

function choseMarkdown(leaf: WorkspaceLeaf, file: TFile): boolean {
	return markdownChosen.get(leaf)?.has(file) ?? false;
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
	// `data` is unset until the text loads (observed), and a later event decides then. It only
	// gates: the marker is read from getViewData, the editor's text, because `data` waits for the
	// 2-second save and would still hold a marker the user just deleted.
	if (!view?.file || !view.data || choseMarkdown(view.leaf, view.file)) return;
	if (isListText(view.getViewData())) void openAsList(view.leaf, view.file);
}

// Through setViewState, never openFile: Markdown is the view `.md` files open in.
// Both update markdownChosen before awaiting setViewState, because `file-open` and
// `active-leaf-change` can fire during the switch.
export async function openAsList(leaf: WorkspaceLeaf, file: TFile): Promise<void> {
	markdownChosen.get(leaf)?.delete(file);
	await leaf.setViewState({ type: VIEW_TYPE_LIST, state: { file: file.path } });
}

export async function openAsMarkdown(leaf: WorkspaceLeaf, file: TFile): Promise<void> {
	const files = markdownChosen.get(leaf) ?? new WeakSet<TFile>();
	markdownChosen.set(leaf, files.add(file));
	await leaf.setViewState({ type: VIEW_TYPE_MARKDOWN, state: { file: file.path } });
}

// Beside the list, with the caret at the end of `line`, where Markdown's own editing tools work.
export async function editInMarkdown(workspace: Workspace, file: TFile, line: number): Promise<void> {
	const leaf = workspace.getLeaf('split');
	await openAsMarkdown(leaf, file);
	if (!(leaf.view instanceof MarkdownView)) return;
	const { editor } = leaf.view;
	const caretLine = Math.min(line, editor.lastLine());
	const at = { line: caretLine, ch: editor.getLine(caretLine).length };
	workspace.setActiveLeaf(leaf, { focus: true });
	editor.setCursor(at);
	editor.scrollIntoView({ from: at, to: at }, true);
	// Making the leaf active doesn't focus its editor on mobile.
	editor.focus();
}
