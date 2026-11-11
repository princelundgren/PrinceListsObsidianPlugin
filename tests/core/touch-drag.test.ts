import { describe, expect, test } from 'vitest';
import { edgeStep, HOLD_MS, isInPlace, isStillHold, MOVE_TOLERANCE_PX, overRow, type RowBox } from '../../src/core/touch-drag';

describe('overRow', () => {
	const boxes: RowBox[] = [
		{ line: 0, top: 0, bottom: 40 },
		{ line: 1, top: 40, bottom: 80 },
		{ line: 3, top: 90, bottom: 130 },
	];

	test.each([
		['the upper half of a box', 10, { line: 0, below: false }],
		['the lower half of a box', 30, { line: 0, below: true }],
		['the gap between boxes, which counts for the next box', 85, { line: 3, below: false }],
		['past the last box', 200, { line: 3, below: true }],
		['above the first box', -5, { line: 0, below: false }],
	])('finds %s', (_, y, expected) => {
		expect(overRow(boxes, y)).toEqual(expected);
	});

	test('finds nothing when there are no boxes', () => {
		expect(overRow([], 10)).toBeNull();
	});
});

describe('edgeStep', () => {
	test.each([
		['the middle of the scroller', 300, 0],
		["the top zone's inner edge", 56, 0],
		["the bottom zone's inner edge", 544, 0],
		['halfway into the top zone', 28, -6],
		['the top edge', 0, -12],
		['beyond the top edge', -20, -12],
		['halfway into the bottom zone', 572, 6],
		['the bottom edge', 600, 12],
		['beyond the bottom edge', 650, 12],
	])('is the step at %s', (_, y, expected) => {
		expect(edgeStep(y, 0, 600)).toBe(expected);
	});

	test("follows the scroller's own top", () => {
		expect(edgeStep(100, 100, 700)).toBe(-12);
	});
});

describe('isInPlace', () => {
	const press = { x: 100, y: 100 };

	test('a point exactly MOVE_TOLERANCE_PX away is in place', () => {
		expect(isInPlace(press, { x: 100, y: 100 + MOVE_TOLERANCE_PX })).toBe(true);
	});

	test('a point 4 px away on each axis, 5.7 px by distance, is not', () => {
		expect(isInPlace(press, { x: 96, y: 104 })).toBe(false);
	});
});

describe('isStillHold', () => {
	const press = { x: 100, y: 100, at: 1000 };

	test('a press held for HOLD_MS and let go in place is a still hold', () => {
		expect(isStillHold(press, { x: 100, y: 100, at: press.at + HOLD_MS })).toBe(true);
	});

	test('a release before HOLD_MS is not', () => {
		expect(isStillHold(press, { x: 100, y: 100, at: press.at + HOLD_MS - 1 })).toBe(false);
	});

	test('a release farther than MOVE_TOLERANCE_PX is not', () => {
		expect(isStillHold(press, { x: 100 + MOVE_TOLERANCE_PX + 1, y: 100, at: press.at + HOLD_MS })).toBe(false);
	});

	test('a release 4 px away on each axis, 5.7 px by distance, is not', () => {
		expect(isStillHold(press, { x: 104, y: 104, at: press.at + HOLD_MS })).toBe(false);
	});

	test('a release exactly MOVE_TOLERANCE_PX away is still a hold', () => {
		expect(isStillHold(press, { x: 100 + MOVE_TOLERANCE_PX, y: 100, at: press.at + HOLD_MS })).toBe(true);
	});
});
