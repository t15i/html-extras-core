import { afterEach, describe, expect, it } from "vitest";
import { computed, effect } from "alien-signals";

import { sourced } from "../../lib/reactive/sourced";

const trash: Element[] = [];
afterEach(() => {
  while (trash.length) trash.pop()!.remove();
});

/**
 * An element to read a value out of, cleaned up after the test.
 *
 * @returns The element, out of the document.
 */
function element(): HTMLElement {
  const created = document.createElement("div");
  trash.push(created);
  return created;
}

describe("sourced()", () => {
  it("stands in for the value until the element has announced", () => {
    const subject = element();
    subject.setAttribute("state", "open");

    const state = sourced(() => subject.getAttribute("state"), null);

    expect(state()).toBe(null);
  });

  it("asks the element once it has announced", () => {
    const subject = element();
    subject.setAttribute("state", "open");

    const state = sourced(() => subject.getAttribute("state"), null);
    state.announce();

    expect(state()).toBe("open");
  });

  it("asks the element again on every read", () => {
    const subject = element();
    const state = sourced(() => subject.getAttribute("state"), null);
    state.announce();

    subject.setAttribute("state", "open");
    expect(state()).toBe("open");

    // No announcement follows, and the answer changes all the same.
    subject.setAttribute("state", "closed");
    expect(state()).toBe("closed");
  });

  it("does not ask the element before it has announced", () => {
    let asks = 0;
    const state = sourced(() => {
      asks++;
      return "asked";
    }, "missing");

    expect(state()).toBe("missing");
    expect(asks).toBe(0);

    state.announce();
    expect(state()).toBe("asked");
    expect(asks).toBe(1);
  });

  it("wakes what reads it on every announcement", () => {
    const subject = element();
    const state = sourced(() => subject.getAttribute("state"), null);

    const runs: (string | null)[] = [];
    effect(() => {
      runs.push(state());
    });

    subject.setAttribute("state", "open");
    state.announce();
    state.announce();

    expect(runs).toEqual([null, "open", "open"]);
  });

  it("lets a computed settle two announcements of one change into one", () => {
    const subject = element();
    const state = sourced(() => subject.getAttribute("state"), null);
    state.announce();

    const upper = computed(() => state()?.toUpperCase() ?? null);

    const seen: (string | null)[] = [];
    effect(() => {
      seen.push(upper());
    });

    subject.setAttribute("state", "open");
    state.announce();
    state.announce();

    expect(seen).toEqual([null, "OPEN"]);
  });
});
