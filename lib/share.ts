/**
 * A channel through which elements of one type share one fact about
 * themselves with the rest of the family.
 *
 * @typeParam E - The type of element the channel carries data for.
 * @typeParam T - The data the channel carries.
 */
export interface Share<E extends object, T> {
  /**
   * Puts `data` on the channel for `element`.
   *
   * @param element - The element the data belongs to.
   * @param data - The data to share.
   */
  share(element: E, data: T): void;

  /**
   * Returns the data `element` put on the channel.
   *
   * @param element - The element to read the data of.
   *
   * @returns The data.
   */
  shared(element: E): T;
}

/**
 * Creates a share channel.
 *
 * @typeParam E - The type of element the channel carries data for.
 * @typeParam T - The data the channel carries.
 *
 * @returns The channel.
 */
export function share<E extends object, T>(): Share<E, T> {
  const shares = new WeakMap<E, T>();
  return {
    share(element: E, data: T): void {
      shares.set(element, data);
    },
    shared(element: E): T {
      return shares.get(element) as T;
    },
  };
}
