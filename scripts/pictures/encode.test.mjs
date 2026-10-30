// Runs with `node --test "scripts/pictures/*.test.mjs"`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeShortFrames, pageFilter } from './encode.mjs';

const frame = (file, ms) => ({ file, ms });

test('mergeShortFrames keeps the last picture of a burst and all of its time', () => {
	assert.deepEqual(mergeShortFrames([frame('a', 500), frame('b', 15), frame('c', 15), frame('d', 900)], 40),
		[frame('a', 500), frame('d', 930)]);
});

test('mergeShortFrames joins a burst into a frame once it lasts long enough', () => {
	assert.deepEqual(mergeShortFrames([frame('a', 25), frame('b', 25), frame('c', 25), frame('d', 25)], 40),
		[frame('b', 50), frame('d', 50)]);
});

test('mergeShortFrames keeps the last frame however short it is', () => {
	assert.deepEqual(mergeShortFrames([frame('a', 500), frame('b', 5)], 40), [frame('a', 500), frame('b', 5)]);
});

test('pageFilter keeps a frame whose screen is the page', () => {
	assert.equal(pageFilter({ width: 720, height: 603 }, { width: 720, height: 603 }), 'crop=iw*1:ih*1:0:0,scale=720:603:flags=lanczos');
});

test('pageFilter cuts a frame down to the page in the corner of a larger screen', () => {
	assert.equal(pageFilter({ width: 200, height: 300 }, { width: 400, height: 900 }), `crop=iw*0.5:ih*${300 / 900}:0:0,scale=200:300:flags=lanczos`);
});
