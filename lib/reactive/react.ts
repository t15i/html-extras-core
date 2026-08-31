import { effect } from "alien-signals";

import { untracked } from "./untracked";
import type { ReadonlySignal } from "./types";

/**
 * Runs `steps` on every announcement `source` makes, and on nothing else.
 *
 * @param source - What announces.
 * @param steps - What to run, given what the source carries.
 *
 * @returns A function that stops running `steps`.
 *
 * @typeParam T - What the source carries.
 */
export function react<T>(
  source: ReadonlySignal<T>,
  steps: (value: T) => (() => void) | void,
): () => void {
  let announced = false;

  return effect(() => {
    const value = source();

    if (!announced) {
      announced = true;
      return;
    }

    return untracked(() => steps(value));
  });
}
