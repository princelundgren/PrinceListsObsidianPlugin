// In Groceries, lemons is opened and gets the curry tag from the tag button, picked from the
// suggestions, then #curry in the tag strip leaves the five items for the curry, under their headings.
import { titleOf } from '../listing.mjs';
import { boundsOf, drawnMouse, hover, middleOf, paneClip, pressEnter, pressEscape, showAlone, sleep, type, undoingChanges } from '../page.mjs';
import { pointer } from '../pointer.mjs';
import { recordGif } from '../record.mjs';

const REST = { x: 520, y: 120 };
const ITEM = 'lemons';
const TAG = 'curry';

const scene = {
	name: 'tags',
	phone: false,
	// With the left sidebar collapsed, this width makes the list's pane 600 wide.
	page: { width: 644, height: 603 },
	clip: paneClip,
	scale: 1,
	theme: 'dark',
	async setup(session) {
		await showAlone(session, 'Groceries.md', 'list');
		await hover(session, REST.x, REST.y);
	},
	async shoot(session, out) {
		try {
			await session.evaluate('app.workspace.leftSplit.collapse()');
			await sleep(600);
			await undoingChanges(session, 'Groceries.md', 'Attachments', () => recordGif(session, scene, out, () => tagAndFilter(session)));
		} finally {
			await session.evaluate('app.workspace.leftSplit.expand()');
		}
	},
};

async function tagAndFilter(session) {
	const mouse = drawnMouse(session, REST.x, REST.y);
	await pointer(session, REST.x, REST.y, 'move');
	await sleep(800);
	const title = await titleOf(session, ITEM);
	await mouse.glide(title.x + 40, title.y + title.height / 2, 700);
	await sleep(250);
	await mouse.click();
	await sleep(900);
	const tagButton = middleOf(await boundsOf(session, '.princelists-card-tag-button'));
	await mouse.glide(tagButton.x, tagButton.y, 600);
	await sleep(300);
	await mouse.click();
	await sleep(500);
	await type(session, TAG.slice(0, 2));
	await sleep(900);
	await pressEnter(session);
	await sleep(1200);
	await pressEscape(session);
	await sleep(300);
	await pressEscape(session);
	await sleep(700);
	const stripTag = middleOf(await boundsOf(session, '.princelists-strip-tag', `#${TAG}`));
	await mouse.glide(stripTag.x, stripTag.y, 800);
	await sleep(300);
	await mouse.click();
	await sleep(900);
	await mouse.glide(REST.x, REST.y, 600);
	await sleep(2400);
}

export default scene;
