import { Notice, type App, type TFile } from 'obsidian';
import type { WriteResult } from '../core/action-write';
import { guardedApply } from '../core/guard';
import { CHANGED_ELSEWHERE_NOTICE, SAVE_FAILED_NOTICE } from '../view/write';

// A one-off action's write to a list from outside its list view, such as a tick in the Schedule view.
// It lands only while the file still holds `expected`, the text the action was worked out on.
export async function editListFile(app: App, file: TFile, expected: string, next: string): Promise<WriteResult> {
	let written = false;
	try {
		await app.vault.process(file, (current) => {
			const result = guardedApply(current, expected, next);
			written = result === next;
			return result;
		});
	} catch (error) {
		console.error(error);
		new Notice(SAVE_FAILED_NOTICE);
		return 'failed';
	}
	if (!written) new Notice(CHANGED_ELSEWHERE_NOTICE);
	return written ? 'written' : 'refused';
}
