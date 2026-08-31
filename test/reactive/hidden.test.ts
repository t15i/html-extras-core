import { afterEach, describe, expect, it } from "vitest";

import { hidden, type Hidden } from "../../lib/reactive/hidden";
import { signal, type Signal } from "../../lib/reactive";

let counter = 0;
const nextTag = (): string => `hidden-test-element-${++counter}`;

const trash: Element[] = [];
afterEach(() => {
  while (trash.length) trash.pop()!.remove();
});

/**
 * An element that hides itself, driving the controller the way an element
 * does: its `attributeChangedCallback` announces the attribute, and nothing
 * else touches it.
 *
 * @param attributes - The attributes the element carries in markup before it
 *   is upgraded. When omitted, the element is created after its definition
 *   instead, and carries nothing.
 *
 * @returns The element, its controller, and the signal of the value it hides
 *   itself with.
 */
function fixture(attributes?: string): {
  element: HTMLElement;
  attribute: Hidden;
  internal: Signal<string | null>;
} {
  const tag = nextTag();
  const internal = signal<string | null>(null);
  let attribute: Hidden | undefined;

  class TestElement extends HTMLElement {
    static observedAttributes = ["hidden"];

    constructor() {
      super();

      attribute = hidden(this, internal);
    }

    attributeChangedCallback(): void {
      attribute!.announce();
    }
  }

  let element: HTMLElement;

  if (attributes === undefined) {
    customElements.define(tag, TestElement);
    element = document.createElement(tag);
    document.body.appendChild(element);
  } else {
    const host = document.createElement("div");
    host.innerHTML = `<${tag} ${attributes}></${tag}>`;
    document.body.appendChild(host);
    trash.push(host);
    element = host.firstElementChild as HTMLElement;
    customElements.define(tag, TestElement);
  }

  trash.push(element);
  return { element, attribute: attribute!, internal };
}

describe("hidden()", () => {
  it("hides the element outright with the empty string", () => {
    const { element, attribute, internal } = fixture();

    internal("");

    expect(element.getAttribute("hidden")).toBe("");
    expect(attribute()).toBe("");
  });

  it("hides the element the user agent can reveal again", () => {
    const { element, attribute, internal } = fixture();

    internal("until-found");

    expect(element.getAttribute("hidden")).toBe("until-found");
    expect(attribute()).toBe("until-found");
  });

  it("shows the element again", () => {
    const { element, internal } = fixture();

    internal("until-found");
    internal(null);

    expect(element.hasAttribute("hidden")).toBe(false);
  });

  it("leaves an element the author hides hidden", () => {
    const { element, attribute, internal } = fixture("hidden");

    internal(null);

    expect(element.getAttribute("hidden")).toBe("");
    expect(attribute()).toBe("");
  });
});
