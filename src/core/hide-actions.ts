const actionsOf = new WeakMap<object, Array<() => void>>();

/**
 * Runs `action` when `owner` hides, after the actions registered for it before. For an API that keeps
 * only one hide callback, such as Obsidian's `Menu.onHide`: the first call for an owner gives
 * `setHideCallback` one callback that runs them all, so no action replaces another.
 */
export function whenHidden(owner: object, setHideCallback: (callback: () => void) => void, action: () => void): void {
	const registered = actionsOf.get(owner);
	if (registered) {
		registered.push(action);
		return;
	}
	const actions = [action];
	actionsOf.set(owner, actions);
	setHideCallback(() => {
		for (const run of actions) run();
	});
}
