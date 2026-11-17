const actionsOf = new WeakMap<object, Array<() => void>>();
const hiddenOwners = new WeakSet<object>();

/**
 * Runs `action` when `owner` hides, after the actions registered for it before, or at once if it
 * already hid. For an API that keeps only one hide callback, such as Obsidian's `Menu.onHide`: the
 * first call for an owner gives `setHideCallback` one callback that runs them all, so no action
 * replaces another.
 */
export function whenHidden(owner: object, setHideCallback: (callback: () => void) => void, action: () => void): void {
	if (hiddenOwners.has(owner)) {
		action();
		return;
	}
	const registered = actionsOf.get(owner);
	if (registered) {
		registered.push(action);
		return;
	}
	const actions = [action];
	actionsOf.set(owner, actions);
	setHideCallback(() => {
		hiddenOwners.add(owner);
		for (const run of actions) run();
	});
}
