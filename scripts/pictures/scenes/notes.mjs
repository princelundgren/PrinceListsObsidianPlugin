// Garden's open item, whose notes hold bold text, a link, a checklist, a table and a picture, with
// the caret at the end of the notes and the format bar under them.
import { boundsOf, click, hover, pressEscape, scroll, showAlone, sleep, still } from '../page.mjs';

const ITEM = 'buy timber for two raised beds';

const scene = {
	name: 'notes',
	phone: false,
	// With the left sidebar collapsed, this width makes the open item 520 wide.
	page: { width: 644, height: 760 },
	scale: 2,
	theme: 'dark',
	async setup(session) {
		await showAlone(session, 'Projects/Garden.md', 'list');
	},
	async clip(session) {
		const { x, y, height } = await boundsOf(session, '.princelists-card');
		return { x, y, width: 520, height };
	},
	async shoot(session, out) {
		try {
			await session.evaluate('app.workspace.leftSplit.collapse()');
			await sleep(400);
			const title = await boundsOf(session, '.princelists-item-title', ITEM);
			await click(session, title.x + 40, title.y + title.height / 2);
			await sleep(800);
			const card = await boundsOf(session, '.princelists-card');
			// Brings the card's top just under the view's header, which ends 77 px down at this size.
			await scroll(session, card.x + card.width / 2, card.y, card.y - 90);
			await sleep(600);
			const end = await session.evaluate(`(() => {
				const { right, y, height } = [...document.querySelectorAll('.princelists-card .cm-line')].at(-1).getBoundingClientRect();
				return { x: right - 4, y: y + height / 2 };
			})()`);
			await click(session, end.x, end.y);
			// Off the format bar, whose buttons show tooltips.
			await hover(session, 640, 756);
			await sleep(800);
			await still(session, scene, out);
		} finally {
			await pressEscape(session);
			await pressEscape(session);
			await session.evaluate('app.workspace.leftSplit.expand()');
		}
	},
};
export default scene;
