import {
  computed,
  effect,
  effectScope,
  endBatch,
  signal,
  startBatch,
  trigger,
} from "alien-signals";

import type { ReadonlySignal, Signal } from "./reactive/types";
import { untracked } from "./reactive";

/**
 * What a reference reads to hear that what it resolves to may have changed.
 *
 * @remarks
 * A tick carries no value: it is read to depend on it and triggered to say
 * that whoever depends on it is out of date.
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
 *
 * @remarks
 * The two are kept apart because their keys are held differently. An ID is a
 * string, which cannot be held weakly, so the ticks kept under one are kept in
 * a map that empties itself as its ticks go - see `claim`. An element can be
 * held weakly, so the ticks kept under one are, and go when it does.
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
 * @remarks
 * What a tick carries, besides the announcement itself, is a claim on its slot
 * in the registry: that is what lets a target find the very tick its
 * references are reading, rather than one nobody is listening to.
 *
 * The claim is made and dropped by the graph itself. A tick is a computed, so
 * reading it inside a computed or an effect links it to that reader, and it is
 * unlinked as soon as that reader stops reading it or is disposed of. The child
 * effect the tick makes while it computes exists for its cleanup alone: a
 * computed disposes of its dependencies when its last subscriber goes, and
 * disposing of an effect runs the cleanup. So the slot is claimed on the first
 * read and released the moment the last reader goes, which is the only way a
 * registry keyed by ID - a key that is a string, and cannot be held weakly -
 * stays as small as what is being referenced.
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
 * @remarks
 * A reference carried by an ID resolves within the root of the referring
 * element and nowhere else, so it meets its target in a root, under a name: a
 * target announces itself in the root it lives in, and only the references in
 * that root are reading. A reference set through IDL has no name to be found
 * by, so it meets its target in a root under the element itself.
 *
 * A tick is the same object on every ask while anything is reading it, and a
 * new one after the last reader goes - which is why a tick is asked for at the
 * moment it is read, and never held on to.
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
 * @remarks
 * An announcement is only ever heard by what is reading the tick, and a tick
 * is in the registry for exactly as long as something is reading it. So there
 * being no tick under the key is not a case to handle: it is the case where
 * nobody is listening, and announcing to nobody is doing nothing. Asking for
 * one here would make a tick nobody reads, only to throw it away again.
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
 * A reference to another element: written with the value of the content
 * attribute that carries it, read as the element it resolves to.
 *
 * @typeParam T - The type of element the reference resolves to.
 */
export interface Reference<T extends Element> {
  (value: string | null): void;
  (): T | null;
}

/**
 * Caches a reference to another element.
 *
 * @remarks
 * The cache is held for as long as something can say that it went stale, and
 * no longer: while the referring element has a root, the reference reads the
 * tick of whatever it resolves through - the root under the ID it carries, or
 * the element an empty attribute stands for - and every read after that is
 * the cached answer. While the element has no root there is nobody to
 * announce anything to it, so it asks the accessor on every read instead.
 *
 * @param accessor - Resolves the reference. It is the reflected attribute
 *   getter of the referring element, which is what applies the rules of the
 *   reference: an ID is looked up in the root of the referring element, an
 *   element set through IDL is taken when it is a descendant of one of that
 *   element's shadow-including ancestors, and either is taken only when its
 *   type matches the type the reflected IDL attribute declares.
 * @param root - The root of the referring element, or null while it has none.
 *
 * @returns The reference: written with the value of the content attribute,
 *   read as the element.
 *
 * @typeParam T - The type of element the reference resolves to.
 */
export function ref<T extends Element>(
  accessor: () => T | null,
  root: ReadonlySignal<Node | null>,
): Reference<T> {
  const id: Signal<string | null> = signal<string | null>(null);
  const tick: Signal<object> = signal({});

  const ref: ReadonlySignal<T | null> = computed(() => {
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

      const e = untracked(ref);
      if (e !== null)
        return [...visible(r)].forEach((r) => link(ticks(r, e), tick));

      return;
    });
  });

  return function (value?: string | null): T | null | void {
    if (value === undefined) {
      if (root() === null) return null;
      return ref();
    }

    if (value === "") {
      startBatch();
      id("");
      trigger(id);
      endBatch();
      return;
    }

    id(value);
  } as Reference<T>;
}

/**
 * What the element declares about itself as the target of references.
 */
export interface RefTargetOptions {
  /**
   * The value of the `id` content attribute of the element.
   */
  id: ReadonlySignal<string | null>;

  /**
   * The root of the element, or null while it has none.
   */
  root: ReadonlySignal<Node | null>;
}

/**
 * Announces an element as the target of references to it.
 *
 * @remarks
 * An announcement says no more than that whoever refers to the element may
 * resolve differently now. It is made where the references that are affected
 * are reading: in the root the element left and in the root it entered, under
 * the ID it dropped and under the ID it took, and on the element itself for
 * the references that hold it rather than name it.
 *
 * @param element - The element to announce.
 * @param options - What the element declares about itself.
 *
 * @returns A function that stops announcing the element.
 */
export function refTarget(
  element: Element,
  options: RefTargetOptions,
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
