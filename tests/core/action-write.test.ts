import { describe, expect, test } from 'vitest';
import { guardedWrite, planAndWrite, type PlanTarget, type WriteResult, type WriteTarget } from '../../src/core/action-write';
import { planItemInsert } from '../../src/core/list-actions';

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
		reread: async () => {
			state.view = state.disk;
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

	test('a write that fails leaves the view holding what the file holds, and the error is thrown', async () => {
		const { state, io } = target('a\n');
		io.process = async (fn) => {
			fn(state.disk);
			throw new Error('disk full');
		};
		await expect(guardedWrite(io, 'b\n', 'a\n')).rejects.toThrow('disk full');
		expect(state).toMatchObject({ view: 'a\n', disk: 'a\n' });
	});

	// Even typing that reads as the action's text: the view took nothing.
	test('a write that fails before the view took anything leaves its text, typing included', async () => {
		for (const typed of ['a typed\n', 'b\n']) {
			const { state, io } = target('a\n');
			io.process = async () => {
				state.view = typed;
				throw new Error('read failed');
			};
			await expect(guardedWrite(io, 'b\n', 'a\n')).rejects.toThrow('read failed');
			expect(state.view).toBe(typed);
		}
	});

	test('a re-read that fails too keeps the write error, with the read error beside it', async () => {
		const { state, io } = target('a\n');
		const writeError = new Error('disk full');
		const readError = new Error('read failed');
		io.process = async (fn) => {
			fn(state.disk);
			throw writeError;
		};
		io.reread = async () => {
			throw readError;
		};
		const thrown = await guardedWrite(io, 'b\n', 'a\n').catch((error: unknown) => error);
		expect(thrown).toBeInstanceOf(AggregateError);
		expect((thrown as AggregateError).errors).toEqual([writeError, readError]);
	});

	test('typing that lands after the view took the text, before the write fails, stays for its own save', async () => {
		const { state, io } = target('a\n');
		io.process = async (fn) => {
			fn(state.disk);
			state.view = 'b typed\n';
			throw new Error('disk full');
		};
		await expect(guardedWrite(io, 'b\n', 'a\n')).rejects.toThrow('disk full');
		expect(state.view).toBe('b typed\n');
	});
});

// A view whose write runs `during` first, as an outside event landing while it writes would, then
// resolves to `result`. `plans` records the text each plan was worked out on.
function planned(text: string, result: WriteResult, during: (state: { view: string; sameFile: boolean }) => void = () => {}) {
	const state = { view: text, sameFile: true, plans: [] as string[] };
	const io: PlanTarget<string> = {
		get text() {
			return state.view;
		},
		sameFile: () => state.sameFile,
		write: async () => {
			during(state);
			return result;
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
		const { state, io, plan } = planned('a\n', 'refused', (s) => (s.view = 'ab\n'));
		expect(await planAndWrite(io, plan)).toBeNull();
		expect(state.plans).toEqual(['a\n', 'ab\n']);
	});

	// Such as opening a card on its line: that line is in the other file now.
	test('a write that lands after the view moved to another file resolves to null, so nothing acts on that file', async () => {
		const { io, plan } = planned('a\n', 'written', (s) => ((s.sameFile = false), (s.view = 'other file\n')));
		expect(await planAndWrite(io, plan)).toBeNull();
	});

	test("a write refused after the view moved to another file isn't worked out again on that file's text", async () => {
		const { state, io, plan } = planned('a\n', 'refused', (s) => ((s.sameFile = false), (s.view = 'other file\n')));
		expect(await planAndWrite(io, plan)).toBeNull();
		expect(state.plans).toEqual(['a\n']);
	});

	// "+" in a list whose first write fails after the view took it and a keystroke landed, with
	// TextFileView.save's rule: it writes the view's text when that isn't what it last saved.
	test('a write that failed is not planned again, though typing kept its text in the view', async () => {
		const state = { view: '- [ ] a\n', disk: '- [ ] a\n', saved: '- [ ] a\n', writes: 0, plans: 0 };
		const io: WriteTarget = {
			get text() {
				return state.view;
			},
			save: async () => {
				if (state.view !== state.saved) state.disk = state.saved = state.view;
			},
			process: async (fn) => {
				if (++state.writes === 1) {
					fn(state.disk);
					state.view = state.view.replace('- [ ] a', '- [ ] ab');
					throw new Error('disk full');
				}
				state.disk = state.saved = fn(state.disk);
			},
			sameFile: () => true,
			took: (next) => {
				state.view = next;
			},
			reread: async () => {
				state.view = state.disk;
			},
		};
		const target: PlanTarget<{ next: string }> = {
			get text() {
				return state.view;
			},
			sameFile: () => true,
			write: (planned, expected) =>
				guardedWrite(io, planned.next, expected).then(
					(outcome) => (outcome === 'written' ? outcome : 'refused'),
					() => 'failed' as const,
				),
		};
		const plan = (text: string) => {
			state.plans++;
			return planItemInsert(text, 0, 'first');
		};
		expect(await planAndWrite(target, plan)).toBeNull();
		expect(state.plans).toBe(1);
		// The view's own save writes the one empty item, with the typing.
		await io.save();
		expect(state.disk).toBe('- [ ] \n- [ ] ab\n');
	});
});
