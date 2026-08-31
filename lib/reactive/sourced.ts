import { cell } from "./cell";
import type { ReadonlySignal } from "./types";

/**
 * A value of an element that the element itself is the source of.
 *
 * @typeParam T - The type of the value.
 */
export interface Sourced<T> extends ReadonlySignal<T> {
  /**
   * Announces that the value may have become a different one.
   */
  announce(): void;
}

/**
 * A value that is kept by the element and not by the graph.
 *
 * @param read - Reads the value out of the element.
 * @param missing - The value until the element has announced anything.
 *
 * @returns The ask and the announcement.
 *
 * @typeParam T - The type of the value.
 */
export function sourced<T>(read: () => T, missing: T): Sourced<T> {
  const told = cell(false);

  return Object.assign(
    function (): T {
      return told() ? read() : missing;
    },
    {
      announce(): void {
        told.set(true);
      },
    },
  );
}
