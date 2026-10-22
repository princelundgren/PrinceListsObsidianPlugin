import { describe, expect, test } from 'vitest';
import { guardedWrite, planAndWrite, type PlanTarget, type WriteTarget } from '../../src/core/action-write';

// A view and its file. `typeDuring` runs inside the write's awaits, as a keystroke landing then would.
function target(text: string, disk = text, typeDuring: { save?: () => void; process?: () => void } = {}) {
	const state = { view: text, disk, sameFile: true };
	const io: WriteTarget = {
		get text() {
			return state.view;
		},
		save: async () => {
			typeDuring.save?.();
		},
		process: async (fn) => {
			await Promise.resolve();
			typeDuring.process?.();
			state.disk = fn(state.disk);
		},
		sameFile: () => state.sameFile,
		took: (next) => {
			state.view = next;
		},
	};
	return { state, io };
}

describe('guardedWrite', () => {
	test('writes the action and the view takes it', async () => {
		const { state, io } = target('a\n');
		expect(await guardedWrite(io, 'b\n', 'a\n')).toBe('written');
		expect(state).toMatchObject({ view: 'b\n', disk: 'b\n' });
	});

	test('typing that lands while the pending typing saves refuses the action and is kept', async () => {
		const { state, io } = target('- [ ] a\n', '- [ ] a\n', { save: () => (state.view = 'Typed\n\n- [ ] a\n') });
		expect(await guardedWrite(io, '- [x] a\n', '- [ ] a\n')).toBe('typed');
		expect(state).toMatchObject({ view: 'Typed\n\n- [ ] a\n', disk: '- [ ] a\n' });
	});

	test('typing that lands just before the write refuses the action and is kept', async () => {
		const { state, io } = target('- [ ] a\n', '- [ ] a\n', { process: () => (state.view = '- [ ] ab\n') });
		expect(await guardedWrite(io, '- [x] a\n', '- [ ] a\n')).toBe('typed');
		expect(state).toMatchObject({ view: '- [ ] ab\n', disk: '- [ ] a\n' });
	});

	test('a file that changed elsewhere refuses the action', async () => {
		const { state, io } = target('a\n', 'elsewhere\n');
		expect(await guardedWrite(io, 'b\n', 'a\n')).toBe('refused');
		expect(state).toMatchObject({ view: 'a\n', disk: 'elsewhere\n' });
	});

	// Such as Undo after a delete: what it expects was taken earlier, and the list changed since.
	test('a view that already differed from what the action expects refuses it, as changed, not typed', async () => {
		const { io } = target('changed since\n');
		expect(await guardedWrite(io, 'before\n', 'after\n')).toBe('refused');
	});

	test('a view that moved to another file meanwhile still writes, but takes nothing', async () => {
		const { state, io } = target('a\n', 'a\n', { save: () => ((state.sameFile = false), (state.view = 'other file\n')) });
		expect(await guardedWrite(io, 'b\n', 'a\n')).toBe('written');
		expect(state).toMatchObject({ view: 'other file\n', disk: 'b\n' });
	});
});

// A view whose write runs `during` first, as an outside event landing while it writes would, then
// resolves to `written`. `plans` records the text each plan was worked out on.
function planned(text: string, written: boolean, during: (state: { view: string; sameFile: boolean }) => void = () => {}) {
	const state = { view: text, sameFile: true, plans: [] as string[] };
	const io: PlanTarget<string> = {
		get text() {
			return state.view;
		},
		sameFile: () => state.sameFile,
		write: async () => {
			during(state);
			return written;
		},
	};
	const plan = (current: string) => {
		state.plans.push(current);
		return `${current}+`;
	};
	return { state, io, plan };
}

describe('planAndWrite', () => {
	test('typing that refuses the write runs the action once more, on the new text', async () => {
		const { state, io, plan } = planned('a\n', false, (s) => (s.view = 'ab\n'));
		expect(await planAndWrite(io, plan)).toBeNull();
		expect(state.plans).toEqual(['a\n', 'ab\n']);
	});

	// Such as opening a card on its line: that line is in the other file now.
	test('a write that lands after the view moved to another file resolves to null, so nothing acts on that file', async () => {
		const { io, plan } = planned('a\n', true, (s) => ((s.sameFile = false), (s.view = 'other file\n')));
		expect(await planAndWrite(io, plan)).toBeNull();
	});

	test("a write refused after the view moved to another file isn't worked out again on that file's text", async () => {
		const { state, io, plan } = planned('a\n', false, (s) => ((s.sameFile = false), (s.view = 'other file\n')));
		expect(await planAndWrite(io, plan)).toBeNull();
		expect(state.plans).toEqual(['a\n']);
	});
});
