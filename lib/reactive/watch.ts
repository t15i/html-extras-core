import { effect } from "alien-signals";

import { untracked } from "./untracked";
import type { ReadonlySignal } from "./types";

/**
 * Runs `cb` on every change of `source`, starting with the value it already
 * carries.
 *
 * @typeParam T - The type the signal carries.
 *
 * @param source - The signal to watch.
 * @param cb - What to run, given the value and the one before it. The one
 *   before it is undefined on the first run, which is what tells a caller
 *   that watches an edge apart from the run that starts the watch. What it
 *   returns, if anything, is the cleanup of that run: it is run before the
 *   next one and when the watch stops, which is what lets a callback that
 *   subscribes to something hand back the way to unsubscribe from it.
 *
 * @returns A function that stops the watch.
 */
export function watch<T>(
  source: ReadonlySignal<T>,
  cb: (value: T, oldValue: T | undefined) => void,
): () => void {
  let prevValue: T | undefined = undefined;
  return effect(() => {
    const value = source();
    const oldValue = prevValue;

    prevValue = value;

    if (value !== oldValue) {
      return untracked(() => cb(value, oldValue));
    }
  });
}
