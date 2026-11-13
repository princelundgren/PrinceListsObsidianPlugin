// Runs with `node --test "scripts/pictures/*.test.mjs"`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { pageExpression, printable } from './run-in-obsidian.mjs';

const run = (body, argument) => runInNewContext(pageExpression(body, argument));

test('pageExpression hands the argument to the body as ARG, quotes and backslashes intact', async () => {
	const argument = 'My "test" vault \\ copy';
	assert.equal(await run('return ARG;', argument), argument);
});

test('pageExpression leaves ARG undefined when no argument is given', async () => {
	assert.equal(await run('return typeof ARG;'), 'undefined');
});

test('pageExpression lets the body await and end in a line comment', async () => {
	assert.equal(await run('const value = await Promise.resolve(2);\nreturn value * 3; // six'), 6);
});

test('printable prints a string as it is and anything else as JSON', () => {
	assert.equal(printable('ticked'), 'ticked');
	assert.equal(printable({ open: true }), '{\n\t"open": true\n}');
});
