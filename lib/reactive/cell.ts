import { signal, trigger } from "alien-signals";

import type { ReadonlySignal, Signal } from "./types";

/**
 * A value the graph keeps, written by announcement rather than by comparison.
 *
 * @typeParam T - The type of the value.
 */
export interface Cell<T> extends ReadonlySignal<T> {
  /**
   * Puts `value` in the cell and announces it.
   *
   * @param value - The value.
   */
  set(value: T): void;
}

/**
 * A value that announces every write, whether or not it changed.
 *
 * @param initial - The value the cell starts with. It is not announced: there
 *   is nobody to hear it yet, and a cell announces writes, not itself.
 *
 * @returns The cell.
 *
 * @typeParam T - The type of the value.
 */
export function cell<T>(initial: T): Cell<T> {
  const tick: Signal<object> = signal({});
  let value = initial;

  return Object.assign(
    function (): T {
      tick();
      return value;
    },
    {
      set(next: T): void {
        value = next;
        trigger(tick);
      },
    },
  );
}
