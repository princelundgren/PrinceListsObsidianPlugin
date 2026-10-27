import type { Workspace } from 'obsidian';
import { VIEW_TYPE_SCHEDULE } from '../constants';

export async function openSchedule(workspace: Workspace): Promise<void> {
	const open = workspace.getLeavesOfType(VIEW_TYPE_SCHEDULE)[0];
	if (open) workspace.setActiveLeaf(open, { focus: true });
	else await workspace.getLeaf('tab').setViewState({ type: VIEW_TYPE_SCHEDULE, active: true });
}
