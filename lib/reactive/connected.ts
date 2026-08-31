import { sourced, type Sourced } from "./sourced";

/**
 * Whether an element is in a document, as the element hears it.
 */
export type Connected = Sourced<boolean>;

/**
 * Where an element is, asked of the element itself and announced by it.
 *
 * @param element - The element whose connection this is.
 *
 * @returns The ask and the announcement.
 */
export function connected(element: Element): Connected {
  return sourced(() => element.isConnected, false);
}
