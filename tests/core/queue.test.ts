import { expect, test } from 'vitest';
import { serialQueue } from '../../src/core/queue';

function deferred() {
	let resolve = () => {};
	const promise = new Promise<void>((done) => (resolve = done));
	return { promise, resolve };
}

test('starts each task only once the one before it has finished', async () => {
	const order: string[] = [];
	const firstStarted = deferred();
	const firstWrite = deferred();
	const enqueue = serialQueue(() => {});
	void enqueue(async () => {
		order.push('first starts');
		firstStarted.resolve();
		await firstWrite.promise;
		order.push('first ends');
	});
	const second = enqueue(async () => {
		order.push('second starts');
	});
	await firstStarted.promise;
	expect(order).toEqual(['first starts']);
	firstWrite.resolve();
	await second;
	expect(order).toEqual(['first starts', 'first ends', 'second starts']);
});

test('reports a failed task and still runs the next one', async () => {
	const errors: unknown[] = [];
	const failure = new Error('write failed');
	const enqueue = serialQueue((error) => errors.push(error));
	const first = enqueue(() => Promise.reject(failure));
	let ran = false;
	const second = enqueue(async () => {
		ran = true;
	});
	await expect(first).resolves.toBeUndefined();
	await second;
	expect(errors).toEqual([failure]);
	expect(ran).toBe(true);
});
