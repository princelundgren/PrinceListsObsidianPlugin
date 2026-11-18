// Groceries with two items ticked and fresh basil's notes open, its link, formatting and checklist
// showing, and the Schedule in the right sidebar: the README's first picture, and the listing's.
import { DESKTOP, RESTING_POINT, showGroceries, titleOf, withTickedGroceries } from '../listing.mjs';
import { click, closeSchedule, hover, middleOf, pressEscape, showScheduleInSidebar, sleep, still } from '../page.mjs';

/** Takes the picture as `scene`, which the listing's first shot shares with this one. */
export async function shootOverview(session, scene, out) {
	try {
		await session.evaluate('app.workspace.leftSplit.collapse()');
		await showScheduleInSidebar(session);
		await withTickedGroceries(session, click, async () => {
			const { x, y } = middleOf(await titleOf(session, 'fresh basil'));
			await click(session, x, y);
			await hover(session, RESTING_POINT.x, RESTING_POINT.y);
			// Soon after the click, while the caret hasn't blinked off.
			await sleep(150);
			try {
				await still(session, scene, out);
			} finally {
				await pressEscape(session);
			}
		});
	} finally {
		await closeSchedule(session);
		await session.evaluate('app.workspace.leftSplit.expand()');
	}
}

const scene = {
	name: 'overview',
	...DESKTOP,
	setup: showGroceries,
	shoot: (session, out) => shootOverview(session, scene, out),
};
export default scene;
