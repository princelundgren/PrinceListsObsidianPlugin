// The Schedule in the right sidebar scrolls through dated items from several lists, under Today,
// Tomorrow, Next 7 days and the start of Later.
import { boundsOf, closeSchedule, drawnMouse, headingBounds, hover, middleOf, paneClip, scroll, showAlone, showScheduleInSidebar, sleep } from '../page.mjs';
import { pointer } from '../pointer.mjs';
import { recordGif } from '../record.mjs';

// In the list, left of where the right sidebar opens.
const REST = { x: 230, y: 332 };
const SCROLL_STEP = 24;
const SCROLL_STEP_MS = 50;

const scene = {
	name: 'schedule',
	phone: false,
	page: { width: 720, height: 603 },
	scale: 1,
	theme: 'dark',
	async setup(session) {
		await showAlone(session, 'To do.md', 'list');
		await hover(session, REST.x, REST.y);
	},
	clip: (session) => paneClip(session, '.mod-right-split'),
	async shoot(session, out) {
		try {
			await session.evaluate('app.workspace.leftSplit.collapse()');
			await showScheduleInSidebar(session);
			const { x, y } = middleOf(await boundsOf(session, '.mod-right-split .princelists-schedule'));
			const mouse = drawnMouse(session, x, y);
			const scrollBy = async (distance) => {
				for (let moved = 0; moved < distance; moved += SCROLL_STEP) {
					await scroll(session, mouse.at.x, mouse.at.y, SCROLL_STEP);
					await sleep(SCROLL_STEP_MS);
				}
			};
			await recordGif(session, scene, out, async () => {
				await pointer(session, x, y, 'move');
				await sleep(1200);
				await scrollBy(320);
				await sleep(900);
				// However many dated items the vault has, the GIF ends with Later's heading in view.
				const later = await headingBounds(session, 'Later');
				await scrollBy(later.y - 200);
				await sleep(1400);
			});
		} finally {
			await closeSchedule(session);
			await session.evaluate('app.workspace.leftSplit.expand()');
		}
	},
};
export default scene;
