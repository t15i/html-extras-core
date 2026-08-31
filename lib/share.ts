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

  /**
   * Returns the data `element` put on the channel, if there is an element to
   * read.
   *
   * @param element - The element to read the data of, if there is one.
   *
   * @returns The data, null when there is no element.
   */
  shared(element: E | null | undefined): NonNullable<T> | null;
}

/**
 * Creates a share.
 *
 * @typeParam E - The type of element the share carries data for.
 * @typeParam T - The data the channel carries.
 *
 * @returns The share.
 */
export function share<E extends object, T>(): Share<E, T> {
  const shares = new WeakMap<E, T>();

  function shared(element: E): T;
  function shared(element: E | null | undefined): NonNullable<T> | null;
  function shared(element: E | null | undefined): T | null {
    if (element === null || element === undefined) return null;

    return shares.get(element) ?? null;
  }

  return {
    share(element: E, data: T): void {
      shares.set(element, data);
    },
    shared,
  };
}
