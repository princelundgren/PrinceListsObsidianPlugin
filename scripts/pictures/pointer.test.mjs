import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { carry, pointer } from './pointer.mjs';

// Stands in for a desktop page, whose elements are those appended to its body, found by their id,
// and a session that runs page scripts against it.
function fakePage() {
	const elements = [];
	const element = () => {
		const el = { style: {}, dataset: {} };
		el.remove = () => elements.splice(elements.indexOf(el), 1);
		return el;
	};
	const document = {
		body: { appendChild: (el) => (elements.push(el), el) },
		createElement: element,
		getElementById: (id) => elements.find((el) => el.id === id) ?? null,
	};
	const context = { document, matchMedia: () => ({ matches: false }) };
	return { document, session: { evaluate: async (expression) => runInNewContext(expression, context) } };
}

test('a carried picture keeps the point the pointer took it by as the pointer moves', async () => {
	const { document, session } = fakePage();
	await carry(session, { src: '', x: 10, y: 20, width: 100, height: 30, round: false }, 30, 25);
	await pointer(session, 130, 225, 'move');
	const carried = document.getElementById('princelists-picture-carried');
	assert.equal(carried.style.left, '110px');
	assert.equal(carried.style.top, '220px');
});

test('hiding the pointer removes a carried picture too', async () => {
	const { document, session } = fakePage();
	await carry(session, { src: '', x: 10, y: 20, width: 100, height: 30, round: false }, 30, 25);
	await pointer(session, 0, 0, 'hide');
	assert.equal(document.getElementById('princelists-picture-carried'), null);
});
