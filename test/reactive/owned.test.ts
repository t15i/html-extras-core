import { afterEach, describe, expect, it } from "vitest";

import { owned, type Owned } from "../../lib/reactive/owned";
import { signal, type Signal } from "../../lib/reactive";

let counter = 0;
const nextTag = (): string => `internal-test-element-${++counter}`;

const trash: Element[] = [];
afterEach(() => {
  while (trash.length) trash.pop()!.remove();
});

/**
 * An element with a content attribute of its own, driving the controller the
 * way an element does: its `attributeChangedCallback` announces the attribute,
 * and nothing else touches it.
 *
 * @param attributes - The attributes the element carries in markup before it
 *   is upgraded. When omitted, the element is created after its definition
 *   instead, and carries nothing.
 *
 * @returns The element, its controller, and the signal of the value it gives
 *   itself.
 */
function fixture(attributes?: string): {
  element: HTMLElement;
  attribute: Owned<string>;
  own: Signal<string | null>;
} {
  const tag = nextTag();
  const own = signal<string | null>(null);
  let attribute: Owned<string> | undefined;

  class TestElement extends HTMLElement {
    static observedAttributes = ["state"];

    constructor() {
      super();

      attribute = owned<string>(this, "state", { internal: own });
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
  return { element, attribute: attribute!, own };
}

describe("owned()", () => {
  it("writes nothing while the element gives itself no value", () => {
    const { element } = fixture();

    expect(element.hasAttribute("state")).toBe(false);
  });

  it("writes the value the element gives itself", () => {
    const { element, attribute, own } = fixture();

    own("open");

    expect(element.getAttribute("state")).toBe("open");
    expect(attribute()).toBe("open");
  });

  it("writes the empty string as a value like any other", () => {
    const { element, attribute, own } = fixture();

    own("");

    expect(element.getAttribute("state")).toBe("");
    expect(attribute()).toBe("");
  });

  it("takes its own value back", () => {
    const { element, attribute, own } = fixture();

    own("open");
    own(null);

    expect(element.hasAttribute("state")).toBe(false);
    expect(attribute()).toBe(null);
  });

  it("leaves the attribute alone once the author writes it", () => {
    const { element, attribute, own } = fixture();

    element.setAttribute("state", "authored");
    own("open");

    expect(element.getAttribute("state")).toBe("authored");
    expect(attribute()).toBe("authored");
  });

  it("belongs to the author when markup carries it", () => {
    const { element, attribute, own } = fixture(`state="authored"`);

    own("open");

    expect(element.getAttribute("state")).toBe("authored");
    expect(attribute()).toBe("authored");
  });

  it("does not remove the value of the author", () => {
    const { element, own } = fixture(`state="authored"`);

    own("open");
    own(null);

    expect(element.getAttribute("state")).toBe("authored");
  });

  it("takes the attribute back when the author removes it", () => {
    const { element, own } = fixture();

    element.setAttribute("state", "authored");
    own("open");
    element.removeAttribute("state");

    expect(element.getAttribute("state")).toBe("open");
  });
});

describe("owned() while it is conceded", () => {
  it("does not remove the attribute it stops wanting", () => {
    const { element, own, attribute } = fixture();

    own("open");
    attribute.concede(() => own(null));

    expect(element.getAttribute("state")).toBe("open");
  });

  it("does not write the value it starts wanting", () => {
    const { element, own, attribute } = fixture();

    attribute.concede(() => own("open"));

    expect(element.hasAttribute("state")).toBe(false);
  });

  it("gives the attribute back at the end of the steps", () => {
    const { element, own, attribute } = fixture();

    own("open");
    attribute.concede(() => own(null));
    own("closed");
    own(null);

    expect(element.hasAttribute("state")).toBe(false);
  });

  it("gives the attribute back when the steps throw", () => {
    const { element, own, attribute } = fixture();

    own("open");
    expect(() =>
      attribute.concede(() => {
        own(null);
        throw new Error("steps");
      }),
    ).toThrow("steps");

    own("closed");

    expect(element.getAttribute("state")).toBe("closed");
  });

  it("takes the attribute back when something else removes it", () => {
    const { element, own, attribute } = fixture();

    own("open");
    attribute.concede(() => {
      own(null);
      element.removeAttribute("state");
    });
    own("closed");

    expect(element.getAttribute("state")).toBe("closed");
  });
});
