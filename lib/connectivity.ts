import { computed, signal } from "alien-signals";

import { watch } from "./reactive/watch";
import type { ReadonlySignal, Signal } from "./reactive/types";

/**
 * What the connection of one element to a document gives its owner.
 */
export interface Connectivity {
  /**
   * Whether the element is in a document.
   */
  connected: Signal<boolean>;

  /**
   * The root of the element, or null while it has none.
   */
  root: ReadonlySignal<Node | null>;

  /**
   * Runs `callback` on every connection of the element.
   *
   * @param callback - What to run.
   *
   * @returns A function that unsubscribes it.
   */
  mount(callback: () => void): () => void;

  /**
   * Runs `callback` on every disconnection of the element.
   *
   * @param callback - What to run.
   *
   * @returns A function that unsubscribes it.
   */
  unmount(callback: () => void): () => void;
}

/**
 * The connection of an element to a document, as a signal and its two edges.
 *
 * @param element - The element whose connection this is.
 *
 * @returns The signal, the root derived from it, and the two edges.
 */
export function connectivity(element: Element): Connectivity {
  const state: Signal<boolean> = signal(false);
  const root = computed(() => (state() ? element.getRootNode() : null));

  const edge =
    (rising: boolean) =>
    (callback: () => void): (() => void) =>
      watch(state, (value, oldValue) => {
        if (oldValue === undefined) return;
        if (value !== rising) return;

        callback();
      });

  return {
    connected: state,
    root,
    mount: edge(true),
    unmount: edge(false),
  };
}
