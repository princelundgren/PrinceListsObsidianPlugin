// An ordinary note in reading view with the Hardware store list embedded in it.
import { boundsOf, hover, showAlone, sleep, still } from '../page.mjs';

const scene = {
	name: 'embedded-list',
	phone: false,
	// With the left sidebar collapsed, this width makes the note's text column 520 wide.
	page: { width: 644, height: 640 },
	scale: 2,
	theme: 'dark',
	async setup(session) {
		await showAlone(session, 'Weekend projects.md', 'note');
	},
	async clip(session) {
		const title = await boundsOf(session, '.workspace-leaf.mod-active .inline-title');
		return { x: title.x - 10, y: title.y - 16, width: 540, height: 495 };
	},
	async shoot(session, out) {
		try {
			await session.evaluate('app.workspace.leftSplit.collapse()');
			// Away from the list's rows, which highlight under the pointer.
			await hover(session, 640, 636);
			await sleep(600);
			await still(session, scene, out);
		} finally {
			await session.evaluate('app.workspace.leftSplit.expand()');
		}
	},
};
export default scene;
