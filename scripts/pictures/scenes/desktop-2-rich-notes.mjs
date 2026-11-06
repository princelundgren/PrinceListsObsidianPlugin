// Garden's open item, whose notes hold bold text, a link, a checklist, a table and a picture, with
// the caret at the end of the notes and the format bar under them.
import { DESKTOP, RESTING_POINT, showWithFolders } from '../listing.mjs';
import { boundsOf, click, hover, pressEscape, scroll, sleep, still } from '../page.mjs';

const ITEM = 'buy timber for two raised beds';

const scene = {
	name: 'desktop-2-rich-notes',
	...DESKTOP,
	setup: (session) => showWithFolders(session, 'Projects/Garden.md', 'list'),
	async shoot(session, out) {
		const title = await boundsOf(session, '.princelists-item-title', ITEM);
		await click(session, title.x + 40, title.y + title.height / 2);
		await sleep(800);
		try {
			const card = await boundsOf(session, '.princelists-card');
			// Brings the card's top just under the view's header.
			await scroll(session, card.x + card.width / 2, card.y, card.y - 90);
			await sleep(600);
			const end = await session.evaluate(`(() => {
				const { right, y, height } = [...document.querySelectorAll('.princelists-card .cm-line')].at(-1).getBoundingClientRect();
				return { x: right - 4, y: y + height / 2 };
			})()`);
			await click(session, end.x, end.y);
			await hover(session, RESTING_POINT.x, RESTING_POINT.y);
			// Soon after the click, while the caret hasn't blinked off.
			await sleep(150);
			await still(session, scene, out);
		} finally {
			await pressEscape(session);
			await pressEscape(session);
		}
	},
};
export default scene;
