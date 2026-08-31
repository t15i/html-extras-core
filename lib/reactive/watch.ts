import { effect } from "alien-signals";

import { untracked } from "./untracked";
import type { ReadonlySignal } from "./types";

/**
 * Runs `cb` every time `source` comes to carry a different value.
 *
 * @param source - The signal to watch.
 * @param cb - What to run, given the value and the one before it. What it
 *   returns, if anything, is the cleanup of that run: it is run before the
 *   next one and when the watch stops, which is what lets a callback that
 *   subscribes to something hand back the way to unsubscribe from it.
 *
 * @returns A function that stops the watch.
 *
 * @typeParam T - The type the signal carries.
 */
export function watch<T>(
  source: ReadonlySignal<T>,
  cb: (value: T, oldValue: T) => void,
): () => void {
  let seen: { value: T } | null = null;

  return effect(() => {
    const value = source();
    const last = seen;

    seen = { value };

    if (last === null) return;
    if (value === last.value) return;

    return untracked(() => cb(value, last.value));
  });
}
