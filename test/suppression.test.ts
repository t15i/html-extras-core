import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";

import { clickSuppressor } from "../lib/suppression";
import { signal, untracked, type Signal } from "../lib/reactive";

/**
 * A capture-phase listener on the root, registered before the module has had
 * any reason to register its own.
 *
 * @remarks
 * Where it stands is the whole point: listeners of one target run in the order
 * they were registered, so the only way to be ahead of the suppressor is to be
 * there before the first element is controlled - that is, at module scope,
 * before the first test has called the fixture.
 */
const earlier = vi.fn();
document.addEventListener("click", earlier, true);

let counter = 0;
const nextTag = (): string => `suppression-test-element-${++counter}`;

interface Fixture {
  element: HTMLElement;
  child: HTMLElement;
  control: () => void;
  disabled: Signal<boolean>;
  clicks: ReturnType<typeof vi.fn>;
}

/**
 * An element under a click suppressor, driving it the way an element does:
 * signals from the callbacks, and the parts of the mechanism that belong to
 * the class - the `click()` override - written out in the class.
 *
 * @param options - Where to connect the element, if not the document body.
 *
 * @returns The element, the suppressor, and what they were given.
 */
function fixture(options: { connect?: Node } = {}): Fixture {
  const tag = nextTag();
  const disabled: Signal<boolean> = signal(false);
  const clicks = vi.fn();

  class TestElement extends HTMLElement {
    readonly control: () => void;
    readonly #root = signal<Node | null>(null);
    readonly #disabled = disabled;

    constructor() {
      super();
      this.control = clickSuppressor(this, {
        suppress: this.#disabled,
        root: this.#root,
      });
    }

    connectedCallback(): void {
      this.#root(this.getRootNode());
    }

    disconnectedCallback(): void {
      this.#root(null);
    }

    override click(): void {
      if (untracked(this.#disabled)) return;
      super.click();
    }
  }

  customElements.define(tag, TestElement);

  const element = document.createElement(tag) as TestElement;
  const child = document.createElement("span");
  child.textContent = "child";
  element.appendChild(child);
  element.addEventListener("click", clicks);

  const parent = options.connect ?? document.body;
  parent.appendChild(element);

  return {
    element,
    child,
    control: element.control,
    disabled,
    clicks,
  };
}

const trash: Element[] = [];
afterEach(() => {
  while (trash.length) trash.pop()!.remove();
});

describe("clickSuppressor()", () => {
  it("lets a click of the user through", async () => {
    const { element, clicks } = fixture();
    trash.push(element);

    await userEvent.click(element);

    expect(clicks).toHaveBeenCalledTimes(1);
  });

  it("does not dispatch a click of the user on a disabled element", async () => {
    const { element, disabled, clicks } = fixture();
    trash.push(element);

    disabled(true);
    await userEvent.click(element);

    expect(clicks).not.toHaveBeenCalled();
  });

  it("does not dispatch a click of the user on a descendant of a disabled element", async () => {
    const { child, disabled, clicks } = fixture();
    trash.push(child.parentElement!);

    disabled(true);
    await userEvent.click(child);

    expect(clicks).not.toHaveBeenCalled();
  });

  it("dispatches a click of the user again once the element is enabled", async () => {
    const { element, disabled, clicks } = fixture();
    trash.push(element);

    disabled(true);
    await userEvent.click(element);
    expect(clicks).not.toHaveBeenCalled();

    disabled(false);
    await userEvent.click(element);
    expect(clicks).toHaveBeenCalledTimes(1);
  });

  it("does not dispatch element.click() on a disabled element", () => {
    const { element, disabled, clicks } = fixture();
    trash.push(element);

    disabled(true);
    element.click();

    expect(clicks).not.toHaveBeenCalled();
  });

  it("dispatches element.click() on an element that is not disabled", () => {
    const { element, clicks } = fixture();
    trash.push(element);

    element.click();

    expect(clicks).toHaveBeenCalledTimes(1);
  });

  it("dispatches a click event a script dispatches, disabled or not", () => {
    const { element, disabled, clicks } = fixture();
    trash.push(element);

    disabled(true);
    element.dispatchEvent(new MouseEvent("click"));

    expect(clicks).toHaveBeenCalledTimes(1);
  });

  it("dispatches an event of another type on a disabled element", async () => {
    const { element, disabled } = fixture();
    trash.push(element);
    const keydowns = vi.fn();
    element.addEventListener("keydown", keydowns);

    disabled(true);
    element.tabIndex = 0;
    element.focus();
    await userEvent.keyboard("{Enter}");

    expect(keydowns).toHaveBeenCalled();
  });

  it("suppresses nothing while the element has no root", async () => {
    const { element, disabled, clicks } = fixture();
    trash.push(element);

    element.remove();
    disabled(true);
    document.body.appendChild(element);
    disabled(false);
    await userEvent.click(element);

    expect(clicks).toHaveBeenCalledTimes(1);
  });

  it("keeps a click of the user from listeners of ancestors", async () => {
    const { element, disabled } = fixture();
    trash.push(element);
    const ancestor = vi.fn();
    document.body.addEventListener("click", ancestor);

    disabled(true);
    await userEvent.click(element);
    document.body.removeEventListener("click", ancestor);

    expect(ancestor).not.toHaveBeenCalled();
  });

  it("listens on the root the element lives in", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    trash.push(host);
    const root = host.attachShadow({ mode: "closed" });
    const add = vi.spyOn(root, "addEventListener");

    trash.push(fixture({ connect: root }).element);

    expect(add).toHaveBeenCalledWith("click", expect.any(Function), true);
  });

  it("stops suppressing once it is stopped", async () => {
    const { element, control, disabled, clicks } = fixture();
    trash.push(element);

    control();
    await userEvent.click(element);
    expect(clicks).toHaveBeenCalledTimes(1);

    disabled(true);
    await userEvent.click(element);
    expect(clicks).toHaveBeenCalledTimes(2);
  });
});

describe("clickSuppressor() against a capture listener registered before it", () => {
  it("leaves the click of the user visible to that listener, and to no one else", async () => {
    const { element, disabled, clicks } = fixture();
    trash.push(element);

    // Every test above it clicked, and each of those clicks reached the
    // listener too.
    earlier.mockClear();

    disabled(true);
    await userEvent.click(element);

    // The residual difference from the platform, which has no event at all to
    // show: the trusted click is created, and whoever was listening on the
    // root before us sees it.
    expect(earlier).toHaveBeenCalledTimes(1);

    // Everything the difference does not extend to.
    expect(clicks).not.toHaveBeenCalled();
  });
});
