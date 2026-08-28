import { afterEach, describe, expect, it } from "vitest";

import { signal, trigger } from "../lib/reactive";
import { ref, ticks } from "../lib/ref";

let counter = 0;
const nextId = (): string => `ref-test-id-${++counter}`;

const trash: Element[] = [];
afterEach(() => {
  while (trash.length) trash.pop()!.remove();
});

/**
 * An element in the document, cleaned up after the test.
 */
function element(id?: string): HTMLElement {
  const element = document.createElement("div");
  if (id !== undefined) element.id = id;
  document.body.appendChild(element);
  trash.push(element);
  return element;
}

/**
 * A shadow root of an element in the document, cleaned up after the test.
 */
function shadow(): ShadowRoot {
  return element().attachShadow({ mode: "open" });
}

describe("ref()", () => {
  it("returns what the accessor resolves", () => {
    const target = element();
    const root = signal<Node | null>(document);

    const reference = ref(() => target, root);
    reference(nextId());

    expect(reference()).toBe(target);
  });

  it("returns null when the accessor resolves nothing", () => {
    const id = signal<string | null>(null);
    const root = signal<Node | null>(document);

    const reference = ref<HTMLElement>(() => null, root);
    reference(id());

    expect(reference()).toBeNull();
  });

  it("caches the resolved value until something invalidates it", () => {
    const id = signal<string | null>(nextId());
    const root = signal<Node | null>(document);

    let current: HTMLElement | null = null;
    const reference = ref(() => current, root);
    reference(id());

    expect(reference()).toBeNull();
    current = element();
    expect(reference()).toBeNull();

    trigger(ticks(document, id()!));
    expect(reference()).toBe(current);
  });

  it("resolves again when the id changes", () => {
    const first = element(nextId());
    const second = element(nextId());
    const id = signal<string | null>(first.id);
    const root = signal<Node | null>(document);

    const reference = ref(
      () => (id() === null ? null : document.getElementById(id()!)),
      root,
    );
    reference(id());

    expect(reference()).toBe(first);

    id(second.id);

    reference(id());
    expect(reference()).toBe(second);

    id(null);

    reference(id());
    expect(reference()).toBeNull();
  });

  it("resolves again when the root of the referring element changes", () => {
    const id = signal<string | null>(nextId());
    const root = signal<Node | null>(shadow());

    let evaluations = 0;
    const reference = ref(() => {
      evaluations++;
      return null;
    }, root);
    reference(id());

    void reference();
    expect(evaluations).toBe(1);

    root(document);
    void reference();
    expect(evaluations).toBe(2);
  });

  it("does not resolve an element of another type carrying the same id", () => {
    const id = nextId();
    const wrong = element(id);
    const root = signal<Node | null>(document);

    const reference = ref<HTMLAnchorElement>(() => {
      const candidate = document.getElementById(id);
      return candidate instanceof HTMLAnchorElement ? candidate : null;
    }, root);
    reference(id);

    expect(document.getElementById(id)).toBe(wrong);
    expect(reference()).toBeNull();
  });
});

describe("ref() and the tick of a root", () => {
  it("reads the tick of its root, under the id it carries", () => {
    const id = nextId();
    const root = signal<Node | null>(document);

    let evaluations = 0;
    const reference = ref<HTMLElement>(() => {
      evaluations++;
      return null;
    }, root);
    reference(id);

    // A reference nobody reads has nothing to invalidate.
    trigger(ticks(document, id));
    expect(evaluations).toBe(0);

    void reference();
    expect(evaluations).toBe(1);

    trigger(ticks(document, id));
    void reference();
    expect(evaluations).toBe(2);
  });

  it("holds one tick for the root and id it carries", () => {
    const id = nextId();
    const root = signal<Node | null>(document);

    const reference = ref<HTMLElement>(() => null, root);
    reference(id);

    void reference();
    const tick = ticks(document, id);

    trigger(tick);
    void reference();

    expect(ticks(document, id)).toBe(tick);
  });

  it("is not woken by an announcement in another root", () => {
    const id = signal<string | null>(nextId());
    const root = signal<Node | null>(document);
    const elsewhere = shadow();

    let evaluations = 0;
    const reference = ref<HTMLElement>(() => {
      evaluations++;
      return null;
    }, root);
    reference(id());

    void reference();
    expect(evaluations).toBe(1);

    // The same ID, in a root the reference cannot resolve into at all.
    trigger(ticks(elsewhere, id()!));
    void reference();
    expect(evaluations).toBe(1);

    trigger(ticks(document, id()!));
    void reference();
    expect(evaluations).toBe(2);
  });

  it("is not woken by another id", () => {
    const id = signal<string | null>(nextId());
    const root = signal<Node | null>(document);

    let evaluations = 0;
    const reference = ref<HTMLElement>(() => {
      evaluations++;
      return null;
    }, root);
    reference(id());

    void reference();
    trigger(ticks(document, nextId()));
    void reference();

    expect(evaluations).toBe(1);
  });

  it("stops reading the tick of the id it no longer carries", () => {
    const first = nextId();
    const second = nextId();
    const id = signal<string | null>(first);
    const root = signal<Node | null>(document);

    let evaluations = 0;
    const reference = ref<HTMLElement>(() => {
      evaluations++;
      return null;
    }, root);
    reference(id());

    void reference();
    id(second);
    reference(id());
    void reference();
    expect(evaluations).toBe(2);

    trigger(ticks(document, first));
    void reference();
    expect(evaluations).toBe(2);

    trigger(ticks(document, second));
    void reference();
    expect(evaluations).toBe(3);
  });

  it("lets go of the tick of the id it no longer carries", () => {
    const id = signal<string | null>(nextId());
    const root = signal<Node | null>(document);

    const reference = ref<HTMLElement>(() => null, root);
    reference(id());
    void reference();

    const carried = id()!;
    const tick = ticks(document, carried);

    id(nextId());
    reference(id());
    void reference();

    // Nothing reads it any more, so nothing keeps it.
    expect(ticks(document, carried)).not.toBe(tick);
  });

  it("stops reading any tick when the id becomes null", () => {
    const id = signal<string | null>(nextId());
    const root = signal<Node | null>(document);

    let evaluations = 0;
    const reference = ref<HTMLElement>(() => {
      evaluations++;
      return null;
    }, root);
    reference(id());

    const carried = id()!;
    void reference();
    id(null);
    reference(id());
    void reference();
    const before = evaluations;

    // An announcement of the id it used to carry no longer wakes it.
    trigger(ticks(document, carried));
    void reference();
    expect(evaluations).toBe(before);
  });

  it("lets go of the tick of the root it left", () => {
    const id = signal<string | null>(nextId());
    const root = signal<Node | null>(document);

    const reference = ref<HTMLElement>(() => null, root);
    reference(id());
    void reference();

    const tick = ticks(document, id()!);

    root(null);

    // A reference that is in no root reads nothing, so nothing holds it from
    // the root it left - which is what keeps a referring element that was
    // taken out of the document collectable.
    expect(ticks(document, id()!)).not.toBe(tick);
  });

  it("moves to the tick of the root it enters", () => {
    const id = signal<string | null>(nextId());
    const entered = shadow();
    const root = signal<Node | null>(document);

    let evaluations = 0;
    const reference = ref<HTMLElement>(() => {
      evaluations++;
      return null;
    }, root);
    reference(id());

    void reference();
    root(entered);
    void reference();
    expect(evaluations).toBe(2);

    trigger(ticks(document, id()!));
    void reference();
    expect(evaluations).toBe(2);

    trigger(ticks(entered, id()!));
    void reference();
    expect(evaluations).toBe(3);
  });
});

describe("ref() and the tick of an element", () => {
  it("reads the tick of the element an empty attribute resolved", () => {
    const target = element();
    const root = signal<Node | null>(document);

    const reference = ref(() => target, root);
    reference("");

    expect(reference()).toBe(target);
    expect(ticks(document, target)).toBe(ticks(document, target));
  });

  it("answers nothing while an empty attribute resolves nothing", () => {
    const root = signal<Node | null>(document);

    // An element set through IDL that is out of reach is resolved by nothing
    // at all, and there is no element whose tick could say that it came into
    // reach either.
    const reference = ref<HTMLElement>(() => null, root);
    reference("");

    expect(reference()).toBeNull();
  });

  it("is woken by the element it resolved", () => {
    const target = element();
    const root = signal<Node | null>(document);

    let evaluations = 0;
    const reference = ref(() => {
      evaluations++;
      return target;
    }, root);
    reference("");

    void reference();
    expect(evaluations).toBe(1);

    trigger(ticks(document, target));
    void reference();
    expect(evaluations).toBe(2);
  });

  it("keeps reading the element that moved out of reach, and resolves it again when it returns", () => {
    const target = element();
    const root = signal<Node | null>(document);

    // What the getter of an element set through IDL does: it answers the
    // element while it is in reach and nothing while it is not, without the
    // attribute changing either way.
    let reachable = true;
    const reference = ref(() => (reachable ? target : null), root);
    reference("");

    expect(reference()).toBe(target);

    reachable = false;
    trigger(ticks(document, target));
    expect(reference()).toBeNull();

    reachable = true;
    trigger(ticks(document, target));
    expect(reference()).toBe(target);
  });

  it("moves to the tick of the element of the next assignment", () => {
    const first = element();
    const second = element();
    const root = signal<Node | null>(document);

    let assigned = first;
    let evaluations = 0;
    const reference = ref(() => {
      evaluations++;
      return assigned;
    }, root);
    reference("");

    expect(reference()).toBe(first);

    // What a second assignment through IDL looks like from here: the same
    // empty string written again, with another element behind it.
    assigned = second;
    reference("");
    expect(reference()).toBe(second);

    const before = evaluations;
    trigger(ticks(document, first));
    void reference();
    expect(evaluations).toBe(before);

    trigger(ticks(document, second));
    void reference();
    expect(evaluations).toBe(before + 1);
  });

  it("stops reading the tick of the element when an id takes over", () => {
    const target = element(nextId());
    const root = signal<Node | null>(document);

    let evaluations = 0;
    const reference = ref(() => {
      evaluations++;
      return target;
    }, root);
    reference("");
    void reference();

    reference(target.id);
    void reference();
    const before = evaluations;

    trigger(ticks(document, target));
    void reference();
    expect(evaluations).toBe(before);

    trigger(ticks(document, target.id));
    void reference();
    expect(evaluations).toBe(before + 1);
  });

  it("reads the tick of every root it can resolve an element in", () => {
    const entered = shadow();
    const target = element();
    const root = signal<Node | null>(entered);

    let evaluations = 0;
    const reference = ref(() => {
      evaluations++;
      return target;
    }, root);
    reference("");

    void reference();
    expect(evaluations).toBe(1);

    // Its own root: an element set through IDL may be in the shadow tree the
    // referring element is in.
    trigger(ticks(entered, target));
    void reference();
    expect(evaluations).toBe(2);

    // And the root above it, which the reference reaches out into.
    trigger(ticks(document, target));
    void reference();
    expect(evaluations).toBe(3);
  });

  it("lets go of every root it was reading for an element", () => {
    const entered = shadow();
    const target = element(nextId());
    const root = signal<Node | null>(entered);

    let evaluations = 0;
    const reference = ref(() => {
      evaluations++;
      return target;
    }, root);
    reference("");
    void reference();

    reference(target.id);
    void reference();
    const before = evaluations;

    // Every tick the chain was read on goes at once, not just the first.
    trigger(ticks(entered, target));
    trigger(ticks(document, target));
    void reference();

    expect(evaluations).toBe(before);
  });

  it("is not woken for an element by a root it cannot resolve in", () => {
    const entered = shadow();
    const elsewhere = shadow();
    const target = element();
    const root = signal<Node | null>(entered);

    let evaluations = 0;
    const reference = ref(() => {
      evaluations++;
      return target;
    }, root);
    reference("");

    void reference();

    // A shadow tree beside its own is on nobody's way out to the document.
    trigger(ticks(elsewhere, target));
    void reference();
    expect(evaluations).toBe(1);
  });

  it("is not woken under an id by an element it holds", () => {
    const target = element(nextId());
    const root = signal<Node | null>(document);

    let evaluations = 0;
    const reference = ref(() => {
      evaluations++;
      return target;
    }, root);
    reference("");

    void reference();
    trigger(ticks(document, target.id));
    void reference();

    expect(evaluations).toBe(1);
  });
});

describe("ref() while the referring element has no root", () => {
  it("reads the tick of no root", () => {
    const id = signal<string | null>(nextId());
    const root = signal<Node | null>(null);

    const reference = ref<HTMLElement>(() => null, root);
    reference(id());
    void reference();

    // A tick nothing reads is a new tick on every ask, in every root there
    // is: the reference is reading none of them.
    expect(ticks(document, id()!)).not.toBe(ticks(document, id()!));
  });
});
