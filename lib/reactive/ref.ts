import { computed, effect, effectScope, signal, trigger } from "alien-signals";

import type { ReadonlySignal, Signal } from "./types";
import { untracked } from "./untracked";

/**
 * What a reference reads to hear that what it resolves to may have changed.
 */
export type Tick = ReadonlySignal<void>;

/**
 * Where the ticks of one kind are kept, by what each of them belongs to.
 */
interface Registry<K> {
  get(key: K): Tick | undefined;
  set(key: K, tick: Tick): unknown;
  delete(key: K): unknown;
}

/**
 * The ticks of one root: the ones a target is found under by ID, and the ones
 * it is found under as itself.
 */
interface Root {
  ids: Registry<string>;
  elements: Registry<Element>;
}

/**
 * The ticks of every root that has any, kept for as long as the root is.
 */
const roots = new WeakMap<Node, Root>();

/**
 * A tick that keeps itself in `registry` under `key` for exactly as long as
 * something is subscribed to it.
 *
 * @param registry - Where the tick belongs.
 * @param key - What it belongs to.
 *
 * @returns The tick.
 */
function claim<K>(registry: Registry<K>, key: K): Tick {
  const self: Tick = computed<void>(() => {
    registry.set(key, self);

    effect(() => () => {
      if (registry.get(key) === self) registry.delete(key);
    });
  });

  return self;
}

/**
 * The tick a reference and its target meet on.
 *
 * @param root - The root the reference and its target meet in.
 * @param key - What the target is found by there: its ID, or the target
 *   itself.
 *
 * @returns The tick.
 */
export function ticks(rootNode: Node, key: string | Element): Tick {
  let root = roots.get(rootNode);
  if (root === undefined) {
    roots.set(rootNode, (root = { ids: new Map(), elements: new WeakMap() }));
  }

  return typeof key === "string"
    ? (root.ids.get(key) ?? claim(root.ids, key))
    : (root.elements.get(key) ?? claim(root.elements, key));
}

/**
 * Announces on the tick under `key` in `root`, if there is one.
 *
 * @param root - The root to announce in.
 * @param key - What the target is found by there: its ID, or the target
 *   itself.
 */
export function tick(rootNode: Node, key: string | Element): void {
  const root = roots.get(rootNode);
  if (root === undefined) return;

  const tick =
    typeof key === "string" ? root.ids.get(key) : root.elements.get(key);
  if (tick === undefined) return;

  trigger(tick);
}

export function link(
  tail: ReadonlySignal<void>,
  head: ReadonlySignal<void>,
): () => void {
  return effect(() => {
    tail();
    return () => trigger(head);
  });
}

/**
 * The roots a referring element in `root` can resolve an element reference
 * into: its own, the one its host lives in, and so on out to the document.
 */
function* visible(root: Node): Generator<Node> {
  let node: Node | null = root;

  while (node !== null) {
    yield node;
    node = node instanceof ShadowRoot ? node.host.getRootNode() : null;
  }
}

/**
 * A reference to another element: read as the element it resolves to.
 *
 * @typeParam T - The type of element the reference resolves to.
 */
export type Reference<T extends Element> = ReadonlySignal<T | null>;

/**
 * Caches a reference to another element.
 *
 * @param accessor - Resolves the reference. It is the reflected attribute
 *   getter of the referring element, which is what applies the rules of the
 *   reference: an ID is looked up in the root of the referring element, an
 *   element set through IDL is taken when it is a descendant of one of that
 *   element's shadow-including ancestors, and either is taken only when its
 *   type matches the type the reflected IDL attribute declares.
 * @param options - What the referring element declares about itself.
 *
 * @returns The reference, read as the element.
 *
 * @typeParam T - The type of element the reference resolves to.
 */
export function ref<T extends Element>(
  accessor: () => T | null,
  {
    id,
    root,
  }: {
    /**
     * The value of the content attribute that carries the reference, null when
     * the element does not carry it.
     */
    id: ReadonlySignal<string | null>;

    /**
     * The root of the referring element, or null while it has none.
     */
    root: ReadonlySignal<Node | null>;
  },
): Reference<T> {
  const tick: Signal<object> = signal({});

  const resolved: ReadonlySignal<T | null> = computed(() => {
    root();
    id();
    tick();
    return accessor();
  });

  effect(() => {
    const r = root();
    if (r === null) return;

    effect(() => {
      const i = id();
      if (i === null) return;
      if (i !== "") return link(ticks(r, i), tick);

      const e = untracked(resolved);
      if (e !== null)
        return [...visible(r)].forEach((r) => link(ticks(r, e), tick));

      return;
    });
  });

  return () => {
    if (root() === null) return null;
    return resolved();
  };
}

/**
 * Announces an element as the target of references to it.
 *
 * @param element - The element to announce.
 * @param options - What the element declares about itself.
 *
 * @returns A function that stops announcing the element.
 */
export function referable(
  element: Element,
  options: {
    /**
     * The value of the `id` content attribute of the element.
     */
    id: ReadonlySignal<string | null>;

    /**
     * The root of the element, or null while it has none.
     */
    root: ReadonlySignal<Node | null>;
  },
): () => void {
  return effectScope(() => {
    effect(() => {
      const root = options.root();
      if (!root) return;

      tick(root, element);

      return () => tick(root, element);
    });

    effect(() => {
      const root = options.root();
      if (!root) return;

      const id = options.id();
      if (!id) return;

      tick(root, id);

      return () => tick(root, id);
    });
  });
}
