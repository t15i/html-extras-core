import { integerParsing } from "@t15i/webspecs/html";
import {
  computed,
  effect,
  endBatch,
  signal,
  startBatch,
  trigger,
} from "alien-signals";

import type { ReadonlySignal } from "./reactive/types";

/**
 * The controller of the `tabindex` content attribute of one element.
 */
export interface TabIndex {
  (value: string | null): void;
  (): number | null;
}

/**
 * The tabindex value of an attribute value.
 *
 * @see https://html.spec.whatwg.org/multipage/interaction.html#tabindex-value
 */
function parseTabIndex(value: string | null): number | null {
  if (value === null) return null;

  const parsed = integerParsing(value);
  return parsed === "error" ? null : parsed;
}

/**
 * Gives an element a `tabindex` of its own, underneath the author's.
 *
 * @param element - The element whose `tabindex` attribute is controlled.
 * @param internal - The value the element gives itself, null for none.
 *
 * @see https://html.spec.whatwg.org/multipage/interaction.html#the-tabindex-attribute
 */
export function tabindex(
  element: Element,
  internal: ReadonlySignal<number | null>,
): TabIndex {
  const observed = signal(parseTabIndex(element.getAttribute("tabindex")));
  const tabindex = computed(() => observed() ?? internal());

  let sync = false;
  let authored = element.hasAttribute("tabindex");

  effect(() => {
    if (observed() !== null) return;

    const tabindex = internal();

    sync = true;
    if (tabindex !== null) {
      element.setAttribute("tabindex", String(tabindex));
      authored = false;
    } else if (!authored) {
      element.removeAttribute("tabindex");
    }
    sync = false;
  });

  return function (value?: string | null): number | null | void {
    if (value === undefined) return tabindex();
    if (sync) return;

    authored = value !== null;

    startBatch();
    observed(parseTabIndex(value));
    trigger(observed);
    endBatch();
  } as TabIndex;
}
