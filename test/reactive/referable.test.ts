import { afterEach, describe, expect, it } from "vitest";

import { effect, signal } from "../../lib/reactive";
import type { ReadonlySignal } from "../../lib/reactive";
import { ref, referable, ticks } from "../../lib/reactive/ref";

let counter = 0;
const nextId = (): string => `ref-target-test-id-${++counter}`;

const trash: Element[] = [];
const stops: Array<() => void> = [];
afterEach(() => {
  while (stops.length) stops.pop()!();
  while (trash.length) trash.pop()!.remove();
});

/**
 * Records what `referable` announces, in the order it announces it.
 *
 * @remarks
 * An announcement is a tick, and a tick is only heard by what reads it, so a
 * test says up front which ticks it is listening to and under what name.
 */
function announcements(): {
  announced: unknown[];
  on: (label: unknown, tick: ReadonlySignal<void>) => void;
} {
  const announced: unknown[] = [];

  const on = (label: unknown, tick: ReadonlySignal<void>): void => {
    let read = false;

    stops.push(
      effect(() => {
        tick();

        if (read) announced.push(label);

        read = true;
      }),
    );
  };

  return { announced, on };
}

/**
 * An element to stand as the target, cleaned up after the test.
 */
function target(): Element {
  const element = document.createElement("a");
  trash.push(element);
  return element;
}

/**
 * A shadow root of an element in the document, cleaned up after the test.
 */
function shadow(): ShadowRoot {
  const host = document.createElement("div");
  document.body.appendChild(host);
  trash.push(host);
  return host.attachShadow({ mode: "open" });
}

describe("referable()", () => {
  it("announces nothing while the element has neither id nor root", () => {
    const element = target();
    const id = signal<string | null>(null);
    const root = signal<Node | null>(null);
    const { announced, on } = announcements();

    on(element, ticks(document, element));
    referable(element, { id, root });

    expect(announced).toEqual([]);
  });

  it("announces the element when it takes an id", () => {
    const element = target();
    const id = signal<string | null>(null);
    const root = signal<Node | null>(document);
    const value = nextId();
    const { announced, on } = announcements();

    on(value, ticks(document, value));
    on(element, ticks(document, element));

    referable(element, { id, root });
    id(value);

    // The element is announced as itself the moment it is a target in a root,
    // which is what a reference holding it is reading; the id it goes on to
    // take is announced apart from that, in the root, under the name.
    expect(announced).toEqual([element, value]);
  });

  it("announces the element when it is connected", () => {
    const id = signal<string | null>(nextId());
    const root = signal<Node | null>(null);
    const element = target();

    referable(element, { id, root });
    const { announced, on } = announcements();

    on(element, ticks(document, element));
    on(id(), ticks(document, id()!));

    root(document);

    expect(announced).toEqual([element, id()]);
  });

  it("announces the element when it is disconnected", () => {
    const id = signal<string | null>(nextId());
    const root = signal<Node | null>(document);
    const element = target();

    referable(element, { id, root });
    const { announced, on } = announcements();

    on(element, ticks(document, element));
    on(id(), ticks(document, id()!));

    root(null);

    // The ID goes to the root it left: that is where the references that can
    // no longer resolve it are reading.
    expect(announced).toEqual([element, id()]);
  });

  it("announces both ids when the element is renamed", () => {
    const first = nextId();
    const second = nextId();
    const id = signal<string | null>(first);
    const root = signal<Node | null>(document);

    referable(target(), { id, root });
    const { announced, on } = announcements();

    on(first, ticks(document, first));
    on(second, ticks(document, second));

    id(second);

    expect(announced).toEqual([first, second]);
  });

  it("announces the old id when the id is removed", () => {
    const value = nextId();
    const id = signal<string | null>(value);
    const root = signal<Node | null>(document);

    referable(target(), { id, root });
    const { announced, on } = announcements();

    on(value, ticks(document, value));

    id(null);

    expect(announced).toEqual([value]);
  });

  it("announces no id on a root change while the element has none", () => {
    const id = signal<string | null>(null);
    const root = signal<Node | null>(null);
    const element = target();

    referable(element, { id, root });
    const { announced, on } = announcements();

    on(element, ticks(document, element));

    root(document);
    root(null);

    // The element itself is announced either way: what a reference set
    // through IDL reaches is a question of where the target is, not of what
    // it is called.
    expect(announced).toEqual([element, element]);
  });

  it("announces an id in the root it left and in the root it entered", () => {
    const id = signal<string | null>(nextId());
    const left = document;
    const entered = shadow();
    const root = signal<Node | null>(left);

    referable(target(), { id, root });
    const { announced, on } = announcements();

    on("left", ticks(left, id()!));
    on("entered", ticks(entered, id()!));

    root(entered);

    expect(announced).toEqual(["left", "entered"]);
  });

  it("announces a rename in the root the element is in", () => {
    const id = signal<string | null>(nextId());
    const root = signal<Node | null>(document);
    const elsewhere = shadow();
    const renamed = nextId();

    referable(target(), { id, root });
    const { announced, on } = announcements();

    on("in the root of the element", ticks(document, renamed));
    on("in another root", ticks(elsewhere, renamed));

    id(renamed);

    expect(announced).toEqual(["in the root of the element"]);
  });

  it("announces no rename while the element has no root", () => {
    const id = signal<string | null>(nextId());
    const root = signal<Node | null>(null);
    const element = target();
    const renamed = nextId();

    referable(element, { id, root });
    const { announced, on } = announcements();

    on(element, ticks(document, element));
    on(id(), ticks(document, id()!));
    on(renamed, ticks(document, renamed));

    id(renamed);

    // Nobody can be reading it: an ID is announced in a root, and the
    // element is in none.
    expect(announced).toEqual([]);
  });

  it("stops announcing the element once it is stopped", () => {
    const id = signal<string | null>(nextId());
    const root = signal<Node | null>(null);
    const element = target();
    const renamed = nextId();

    const stop = referable(element, { id, root });
    const { announced, on } = announcements();

    on(element, ticks(document, element));
    on(id(), ticks(document, id()!));
    on(renamed, ticks(document, renamed));

    stop();
    root(document);
    id(renamed);

    expect(announced).toEqual([]);
  });
});

describe("ref() and referable() together", () => {
  /**
   * A target driven by the signals its element would drive from its callbacks,
   * and a reference to it that resolves the way a reflected attribute does.
   */
  function pair() {
    const target = document.createElement("a");
    trash.push(target);

    const targetId = signal<string | null>(null);
    const targetRoot = signal<Node | null>(null);
    referable(target, { id: targetId, root: targetRoot });

    const connect = (): void => {
      document.body.appendChild(target);
      targetRoot(target.getRootNode());
    };
    const disconnect = (): void => {
      target.remove();
      targetRoot(null);
    };
    const rename = (value: string | null): void => {
      if (value === null) target.removeAttribute("id");
      else target.id = value;
      targetId(value);
    };

    const referenceId = signal<string | null>(null);
    const referenceRoot = signal<Node | null>(document);
    const reference = ref<HTMLAnchorElement>(
      () => {
        const carried = referenceId();
        if (carried === null) return null;

        const candidate = document.getElementById(carried);
        return candidate instanceof HTMLAnchorElement ? candidate : null;
      },
      { id: referenceId, root: referenceRoot },
    );

    /** Hands the reference an attribute value, the way a reaction does. */
    const point = (value: string | null): void => {
      referenceId(value);
    };

    return { target, connect, disconnect, rename, point, reference };
  }

  it("resolves a target that is connected after the reference is made", () => {
    const { target, connect, rename, point, reference } = pair();
    const id = nextId();

    point(id);
    expect(reference()).toBeNull();

    rename(id);
    connect();

    expect(reference()).toBe(target);
  });

  it("loses a target that is disconnected", () => {
    const { target, connect, disconnect, rename, point, reference } = pair();
    const id = nextId();

    rename(id);
    connect();
    point(id);
    expect(reference()).toBe(target);

    disconnect();
    expect(reference()).toBeNull();
  });

  it("loses a target held through IDL in the shadow tree they share", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    trash.push(host);
    const root = host.attachShadow({ mode: "open" });

    const element = document.createElement("a");
    root.appendChild(element);

    const elementRoot = signal<Node | null>(element.getRootNode());
    referable(element, { id: signal<string | null>(null), root: elementRoot });

    let reachable = true;
    const carried = signal<string | null>(null);
    const reference = ref<HTMLAnchorElement>(
      () => (reachable ? element : null),
      { id: carried, root: signal<Node | null>(root) },
    );
    carried("");

    expect(reference()).toBe(element);

    // The target announces itself in the root it is in, which is the shadow
    // tree - not the document the two of them are under.
    reachable = false;
    element.remove();
    elementRoot(null);

    expect(reference()).toBeNull();
  });

  it("loses a target that is renamed, and finds it again under the new id", () => {
    const { target, connect, rename, point, reference } = pair();
    const first = nextId();
    const second = nextId();

    rename(first);
    connect();
    point(first);
    expect(reference()).toBe(target);

    rename(second);
    expect(reference()).toBeNull();

    point(second);
    expect(reference()).toBe(target);
  });
});
