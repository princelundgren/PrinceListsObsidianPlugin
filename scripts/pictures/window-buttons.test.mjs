import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { drawWindowButtons, removeWindowButtons } from './window-buttons.mjs';

// Stands in for a desktop page, on a Mac unless `macos` is false, and a session that runs page
// scripts against it.
function fakePage({ macos = true } = {}) {
	const elements = [];
	const element = () => {
		const el = { style: {}, children: [] };
		el.appendChild = (child) => (el.children.push(child), child);
		el.remove = () => elements.splice(elements.indexOf(el), 1);
		return el;
	};
	const body = { classList: { contains: (name) => macos && name === 'mod-macos' }, appendChild: (el) => (elements.push(el), el) };
	const document = { body, createElement: element, getElementById: (id) => elements.find((el) => el.id === id) ?? null };
	return { elements, session: { evaluate: async (expression) => runInNewContext(expression, { document }) } };
}

test('the buttons are drawn once, and removed again', async () => {
	const { elements, session } = fakePage();
	await drawWindowButtons(session);
	await drawWindowButtons(session);
	assert.equal(elements.length, 1);
	assert.equal(elements[0].children.length, 3);
	await removeWindowButtons(session);
	assert.equal(elements.length, 0);
});

test('no buttons are drawn off a Mac', async () => {
	const { elements, session } = fakePage({ macos: false });
	await drawWindowButtons(session);
	assert.equal(elements.length, 0);
});
