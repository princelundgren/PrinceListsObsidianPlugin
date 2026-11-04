import type { Workspace } from 'obsidian';
import { VIEW_TYPE_SCHEDULE } from '../constants';

/** Shows the Schedule where it is open, else opens it in the right sidebar, and makes it active. */
export async function openSchedule(workspace: Workspace): Promise<void> {
	const open = workspace.getLeavesOfType(VIEW_TYPE_SCHEDULE)[0];
	if (!open) {
		await workspace.ensureSideLeaf(VIEW_TYPE_SCHEDULE, 'right', { active: true });
		return;
	}
	await workspace.revealLeaf(open);
	workspace.setActiveLeaf(open, { focus: true });
}

/** Adds the Schedule as a right-sidebar tab without showing it, unless it is open somewhere already. */
export async function addScheduleTab(workspace: Workspace): Promise<void> {
	if (workspace.getLeavesOfType(VIEW_TYPE_SCHEDULE).length > 0) return;
	await workspace.ensureSideLeaf(VIEW_TYPE_SCHEDULE, 'right', { active: false, reveal: false });
}
