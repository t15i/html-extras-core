import { effect } from "alien-signals";

import { untracked } from "./reactive/untracked";
import type { ReadonlySignal } from "./reactive/types";

/**
 * The predicate of every element under a suppressor.
 */
const suppressed = new WeakMap<EventTarget, ReadonlySignal<boolean>>();

/**
 * Suppresses a click on a suppressed element the way the platform does on a
 * disabled one.
 *
 * @param event - The click event.
 */
function suppressor(event: Event): void {
  if (!event.isTrusted) return;

  for (const target of event.composedPath()) {
    const predicate = suppressed.get(target);
    if (predicate === undefined) continue;
    if (!untracked(predicate)) continue;

    event.stopImmediatePropagation();
    event.preventDefault();
    return;
  }
}

/**
 * Suppresses the clicks a user produces on an element while it asks for it.
 *
 * @param element - The element to suppress the clicks on.
 * @param options - What the element declares about the suppression.
 *
 * @returns The suppressor.
 * @see https://html.spec.whatwg.org/multipage/form-elements.html#attr-option-disabled
 */
export function clickSuppressor(
  element: HTMLElement,
  options: {
    /**
     * Whether the clicks a user produces on the element are to be suppressed.
     */
    suppress: ReadonlySignal<boolean>;

    /**
     * The root of the element, or null while it has none.
     */
    root: ReadonlySignal<Node | null>;
  },
): () => void {
  suppressed.set(element, options.suppress);

  const stop = effect(() => {
    const root = options.root();
    if (root === null) return;

    root.addEventListener("click", suppressor, true);
  });

  return () => {
    suppressed.delete(element);
    stop();
  };
}
