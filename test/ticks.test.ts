import { afterEach, describe, expect, it } from "vitest";

import { computed, effect, trigger } from "../lib/reactive";
import { tick, ticks } from "../lib/ref";

let counter = 0;
const nextId = (): string => `ticks-test-id-${++counter}`;

const trash: Element[] = [];
const stops: Array<() => void> = [];
afterEach(() => {
  while (stops.length) stops.pop()!();
  while (trash.length) trash.pop()!.remove();
});

/**
 * An element in the document, cleaned up after the test.
 */
function element(): HTMLElement {
  const element = document.createElement("div");
  document.body.appendChild(element);
  trash.push(element);
  return element;
}

/**
 * Reads `tick` until the test is over, and counts what that read it again.
 */
function reader(tick: () => void): () => number {
  let reads = 0;

  stops.push(
    effect(() => {
      tick();
      reads++;
    }),
  );

  return () => reads;
}

describe("ticks()", () => {
  it("wakes what reads it when it is triggered", () => {
    const reads = reader(ticks(document, nextId()));
    const id = nextId();

    const read = reader(ticks(document, id));
    expect(read()).toBe(1);

    trigger(ticks(document, id));
    expect(read()).toBe(2);

    // What is triggered is one tick, not all of them.
    expect(reads()).toBe(1);
  });

  it("is the same tick on every ask while something reads it", () => {
    const id = nextId();
    const tick = ticks(document, id);

    reader(tick);

    expect(ticks(document, id)).toBe(tick);
    trigger(ticks(document, id));
    expect(ticks(document, id)).toBe(tick);
  });

  it("is a new tick on every ask while nothing reads it", () => {
    const id = nextId();

    expect(ticks(document, id)).not.toBe(ticks(document, id));
  });

  it("forgets a tick when the last reader goes", () => {
    const id = nextId();
    const tick = ticks(document, id);

    const first = stops.length;
    reader(tick);
    const second = stops.length;
    reader(tick);

    stops[second]!();
    expect(ticks(document, id)).toBe(tick);

    stops[first]!();
    expect(ticks(document, id)).not.toBe(tick);
  });

  it("forgets a tick that was only triggered", () => {
    const id = nextId();

    trigger(ticks(document, id));

    expect(ticks(document, id)).not.toBe(ticks(document, id));
  });

  it("forgets a tick the computed that read it stopped reading", () => {
    const id = nextId();
    const tick = ticks(document, id);

    let reading = true;
    const value = computed(() => {
      if (reading) tick();
      return reading;
    });

    reader(() => void value());
    expect(ticks(document, id)).toBe(tick);

    reading = false;
    trigger(tick);
    expect(ticks(document, id)).not.toBe(tick);
  });

  it("takes its slot back when it is read again after it was forgotten", () => {
    const id = nextId();
    const forgotten = ticks(document, id);

    const gone = stops.length;
    reader(forgotten);
    stops[gone]!();

    const taken = ticks(document, id);
    const holder = stops.length;
    reader(taken);

    // Reading a tick that was forgotten makes it claim the slot again, over
    // the tick that took it in the meantime.
    reader(forgotten);
    expect(ticks(document, id)).toBe(forgotten);

    // The tick it displaced holds no claim on the slot, so it takes nothing
    // away when the last thing reading it goes.
    stops[holder]!();
    expect(ticks(document, id)).toBe(forgotten);
  });

  it("tells one id in a root from another", () => {
    const first = nextId();
    const second = nextId();

    const read = reader(ticks(document, first));
    reader(ticks(document, second));

    trigger(ticks(document, second));

    expect(read()).toBe(1);
    expect(ticks(document, first)).not.toBe(ticks(document, second));
  });

  it("tells one root from another under the same id", () => {
    const id = nextId();
    const elsewhere = element().attachShadow({ mode: "open" });

    const read = reader(ticks(document, id));
    reader(ticks(elsewhere, id));

    trigger(ticks(elsewhere, id));

    expect(read()).toBe(1);
    expect(ticks(document, id)).not.toBe(ticks(elsewhere, id));
  });

  it("tells the tick of an element from the tick of a root", () => {
    const target = element();
    const id = nextId();

    const read = reader(ticks(document, id));
    reader(ticks(document, target));

    trigger(ticks(document, target));

    expect(read()).toBe(1);
  });

  it("is the tick of the element wherever the element is", () => {
    const target = element();
    const tick = ticks(document, target);

    reader(tick);
    expect(ticks(document, target)).toBe(tick);

    // The key is the element itself, so where the element ends up says
    // nothing about which tick answers for it.
    element().attachShadow({ mode: "open" }).appendChild(target);
    expect(ticks(document, target)).toBe(tick);
  });
});

describe("tick()", () => {
  it("wakes what reads the tick of an id in a root", () => {
    const id = nextId();
    const read = reader(ticks(document, id));

    tick(document, id);
    expect(read()).toBe(2);
  });

  it("wakes what reads the tick of an element", () => {
    const target = element();
    const read = reader(ticks(document, target));

    tick(document, target);
    expect(read()).toBe(2);
  });

  it("makes no tick under a key nothing reads", () => {
    const id = nextId();

    tick(document, id);

    // Announcing to nobody leaves nothing behind: the next ask is still a
    // tick of its own.
    expect(ticks(document, id)).not.toBe(ticks(document, id));
  });

  it("announces nothing in a root that holds no ticks", () => {
    const elsewhere = element().attachShadow({ mode: "open" });
    const id = nextId();
    const read = reader(ticks(document, id));

    // The same id, in a root nothing has ever been read in.
    tick(elsewhere, id);
    expect(read()).toBe(1);
  });
});
