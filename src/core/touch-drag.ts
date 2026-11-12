export const HOLD_MS = 500;
export const MOVE_TOLERANCE_PX = 5;
export const EDGE_ZONE_PX = 56;
export const EDGE_STEP_MAX_PX = 12;

/** Where a pointer was pressed or is now, in the page's pixels. */
export interface PointerMark {
	x: number;
	y: number;
}

/** Whether `point` is within `MOVE_TOLERANCE_PX` of where `press` began, by distance. */
export function isInPlace(press: PointerMark, point: PointerMark): boolean {
	return Math.hypot(point.x - press.x, point.y - press.y) <= MOVE_TOLERANCE_PX;
}

/** A shown row's, heading's or untouched block's first line and vertical extent in the scroller's content coordinates. */
export interface RowBox {
	line: number;
	top: number;
	bottom: number;
}

// The first box ending below `y`, and whether `y` is past its middle. Past every box, below the last
// one. The result is what `dropAt` takes as `over`.
export function overRow(boxes: readonly RowBox[], y: number): { line: number; below: boolean } | null {
	const last = boxes[boxes.length - 1];
	if (!last) return null;
	const box = boxes.find((candidate) => candidate.bottom > y);
	if (!box) return { line: last.line, below: true };
	return { line: box.line, below: y > (box.top + box.bottom) / 2 };
}

// How far to scroll this frame for a finger at viewport `y`: negative in the top zone, positive in the
// bottom one, growing linearly from the zone's inner edge to the edge.
export function edgeStep(y: number, top: number, bottom: number): number {
	const intoTop = top + EDGE_ZONE_PX - y;
	if (intoTop > 0) return -scaled(intoTop);
	const intoBottom = y - (bottom - EDGE_ZONE_PX);
	return intoBottom > 0 ? scaled(intoBottom) : 0;
}

function scaled(depth: number): number {
	return (Math.min(depth, EDGE_ZONE_PX) / EDGE_ZONE_PX) * EDGE_STEP_MAX_PX;
}
