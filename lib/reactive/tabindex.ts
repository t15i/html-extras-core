import { integerParsing } from "@t15i/webspecs/html";

import { owned, type Owned } from "./owned";
import type { ReadonlySignal } from "./types";

/**
 * The controller of the `tabindex` content attribute of one element.
 */
export type TabIndex = Owned<number>;

/**
 * The tabindex value of an attribute value.
 *
 * @param value - The value of the attribute.
 *
 * @returns The tabindex value, null when the attribute value has none.
 *
 * @see https://html.spec.whatwg.org/multipage/interaction.html#tabindex-value
 */
function parseTabIndex(value: string): number | null {
  const parsed = integerParsing(value);
  return parsed === "error" ? null : parsed;
}

/**
 * Gives an element a `tabindex` of its own, underneath the author's.
 *
 * @param element - The element whose `tabindex` attribute is controlled.
 * @param internal - The tabindex value the element gives itself, null for
 *   none.
 *
 * @returns The controller.
 *
 * @see https://html.spec.whatwg.org/multipage/interaction.html#the-tabindex-attribute
 */
export function tabindex(
  element: Element,
  internal: ReadonlySignal<number | null>,
): TabIndex {
  return owned(element, "tabindex", { internal, parse: parseTabIndex });
}
