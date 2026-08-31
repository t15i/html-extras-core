import { owned, type Owned } from "./owned";
import type { ReadonlySignal } from "./types";

/**
 * The controller of the `hidden` content attribute of one element.
 */
export type Hidden = Owned<string>;

/**
 * Gives an element a `hidden` of its own, underneath the author's.
 *
 * @param element - The element whose `hidden` attribute is controlled.
 * @param internal - The value the element hides itself with, null for none.
 *   The empty string hides the element outright; `until-found` hides it the
 *   way the user agent can reveal again.
 *
 * @returns The controller.
 *
 * @see https://html.spec.whatwg.org/multipage/interaction.html#the-hidden-attribute
 */
export function hidden(
  element: Element,
  internal: ReadonlySignal<string | null>,
): Hidden {
  return owned<string>(element, "hidden", { internal });
}
