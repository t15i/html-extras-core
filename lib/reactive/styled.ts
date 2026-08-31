import { effect } from "alien-signals";

import type { ReadonlySignal } from "./types";

/**
 * Puts a style sheet into the root an element is in, for every root it is in.
 *
 * @param sheet - The sheet to put there.
 * @param options - What the element declares about itself.
 *
 * @returns A function that stops adding the sheet to further roots.
 */
export function styled(
  sheet: CSSStyleSheet,
  options: {
    /**
     * The root of the element, or null while it has none.
     */
    root: ReadonlySignal<Node | null>;
  },
): () => void {
  return effect(() => {
    const node = options.root();
    if (node === null) return;

    const { adoptedStyleSheets } = node as Node & DocumentOrShadowRoot;

    if (adoptedStyleSheets.includes(sheet)) return;
    adoptedStyleSheets.push(sheet);
  });
}
