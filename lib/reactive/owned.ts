import { computed, effect } from "alien-signals";

import { cell } from "./cell";
import { react } from "./react";
import { sourced } from "./sourced";
import type { ReadonlySignal } from "./types";

/**
 * The controller of one content attribute of an element, read as what the
 * attribute stands for.
 *
 * @typeParam T - What an attribute value stands for.
 */
export interface Owned<T> {
  /**
   * What the attribute stands for, null when it stands for nothing.
   */
  (): T | null;

  /**
   * Announces that the attribute may have been written.
   */
  announce(): void;

  /**
   * Runs `steps` while the attribute is not the element's to write.
   *
   * @param steps - What to run.
   */
  concede(steps: () => void): void;
}

/**
 * Gives an element a value of its own for a content attribute, underneath the
 * author's.
 *
 * @param element - The element whose attribute this is.
 * @param name - The name of the attribute.
 * @param options - What the element says about the attribute.
 *
 * @returns The controller.
 *
 * @typeParam T - What an attribute value stands for.
 */
export function owned<T = string>(
  element: Element,
  name: string,
  options: {
    /**
     * The value the element gives itself, null for none.
     */
    internal: ReadonlySignal<T | null>;

    /**
     * What an attribute value stands for, null when it stands for nothing.
     *
     * @param value - The value of the attribute.
     *
     * @returns What it stands for.
     */
    parse?(value: string): T | null;

    /**
     * The attribute value a value is written as.
     *
     * @param value - The value.
     *
     * @returns The value of the attribute.
     */
    format?(value: T): string;
  },
): Owned<T> {
  const { internal: own } = options;

  const external = sourced(() => element.getAttribute(name), null);

  const parse = options.parse ?? ((value: string): T | null => value as T);
  const format = options.format ?? ((value: T): string => String(value));

  const meaning = (value: string | null): T | null =>
    value === null ? null : parse(value);

  /**
   * What stands in the attribute when the element is not the one who wrote it.
   * It starts empty rather than at what the attribute carries: the controller
   * hears about the attribute from the element, and the element has not
   * spoken yet.
   */
  const authored = cell<string | null>(null);

  /** Whether the element is writing the attribute right now. */
  let writing = false;

  /** Whether what stands in the attribute was put there by the element. */
  let ours = false;

  /** Whether the attribute is not the element's to write for the moment. */
  let conceded = false;

  // The attribute changes hands on a write, and a write is an event. The run
  // of an effect is not one, so what is heard here is the announcement.
  react(external, () => {
    if (writing) return;

    ours = false;
    authored.set(element.getAttribute(name));
  });

  effect(() => {
    const author = authored();
    const value = own();

    if (meaning(author) !== null) return;
    if (conceded) return;

    writing = true;
    try {
      if (value !== null) {
        element.setAttribute(name, format(value));
        ours = true;
      } else if (ours) {
        element.removeAttribute(name);
        ours = false;
      }
    } finally {
      writing = false;
    }
  });

  const effective = computed(() => meaning(authored()) ?? own());

  return Object.assign((): T | null => effective(), {
    announce: (): void => external.announce(),
    concede(steps: () => void): void {
      conceded = true;
      try {
        steps();
      } finally {
        conceded = false;
      }
    },
  });
}
