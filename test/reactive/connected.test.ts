import { afterEach, describe, expect, it } from "vitest";
import { computed, effect } from "alien-signals";

import { connected } from "../../lib/reactive/connected";

const trash: Element[] = [];
afterEach(() => {
  while (trash.length) trash.pop()!.remove();
});

/**
 * An element to hang a connection on, cleaned up after the test.
 *
 * @param id - The identifier to give it.
 *
 * @returns The element, out of the document.
 */
function element(id = ""): HTMLElement {
  const created = document.createElement("div");
  created.id = id;
  trash.push(created);
  return created;
}

describe("connected()", () => {
  it("takes an element that has announced nothing for disconnected", () => {
    const subject = element();
    document.body.append(subject);

    expect(connected(subject)()).toBe(false);
  });

  it("takes an element that has announced for what the tree says", () => {
    const subject = element();
    const ask = connected(subject);

    document.body.append(subject);
    ask.announce();
    expect(ask()).toBe(true);

    subject.remove();
    ask.announce();
    expect(ask()).toBe(false);
  });

  it("remembers nothing between announcements", () => {
    const subject = element();
    const ask = connected(subject);

    document.body.append(subject);
    ask.announce();

    // No announcement follows, and the answer changes all the same.
    subject.remove();
    expect(ask()).toBe(false);
  });

  it("wakes what reads it on every announcement", () => {
    const subject = element();
    const ask = connected(subject);
    document.body.append(subject);

    const runs: boolean[] = [];
    effect(() => {
      runs.push(ask());
    });

    ask.announce();
    ask.announce();

    expect(runs).toEqual([false, true, true]);
  });

  it("lets a computed settle the announcements of one move into one change", () => {
    const from = element("from");
    const to = element("to");
    document.body.append(from, to);

    const subject = element();
    from.append(subject);

    const ask = connected(subject);
    ask.announce();

    const parent = computed(() => {
      ask();
      return subject.parentElement?.id ?? null;
    });

    const seen: (string | null)[] = [];
    effect(() => {
      seen.push(parent());
    });

    // A move is announced twice - once for the removal and once for the
    // insertion - and the tree is already in its final shape for both.
    to.append(subject);
    ask.announce();
    ask.announce();

    expect(seen).toEqual(["from", "to"]);
  });
});
