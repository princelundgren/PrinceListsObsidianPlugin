// The README's first picture, under a caption, as the listing's first shot.
import overview, { shootOverview } from './overview.mjs';

const scene = {
	...overview,
	name: 'desktop-1-groceries',
	caption: 'Todo lists, kept as plain Markdown notes',
	shoot: (session, out) => shootOverview(session, scene, out),
};
export default scene;
