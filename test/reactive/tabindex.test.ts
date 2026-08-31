import { afterEach, describe, expect, it } from "vitest";

import { tabindex, type TabIndex } from "../../lib/reactive/tabindex";
import { signal, type Signal } from "../../lib/reactive";

let counter = 0;
const nextTag = (): string => `tabindex-test-element-${++counter}`;

const trash: Element[] = [];
afterEach(() => {
  while (trash.length) trash.pop()!.remove();
});

/**
 * An element controlled by a `tabindex` controller, driving it the way an
 * element does: its `attributeChangedCallback` announces the attribute, and
 * nothing else touches it.
 *
 * @param attributes - The attributes the element carries in markup before it
 *   is upgraded. When omitted, the element is created after its definition
 *   instead, and carries nothing.
 */
function fixture(attributes?: string): {
  element: HTMLElement;
  attribute: TabIndex;
  internal: Signal<number | null>;
} {
  const tag = nextTag();
  const internal = signal<number | null>(null);
  let attribute: TabIndex | undefined;

  class TestElement extends HTMLElement {
    static observedAttributes = ["tabindex"];

    constructor() {
      super();

      attribute = tabindex(this, internal);
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

describe("tabindex()", () => {
  it("writes nothing while the element gives itself no value", () => {
    const { element } = fixture();

    expect(element.hasAttribute("tabindex")).toBe(false);
  });

  it("writes the value the element gives itself", () => {
    const { element, internal } = fixture();

    internal(-1);
    expect(element.getAttribute("tabindex")).toBe("-1");
  });

  it("writes a value of zero as a value like any other", () => {
    const { element, internal } = fixture();

    internal(0);
    expect(element.getAttribute("tabindex")).toBe("0");
  });

  it("removes the attribute when the element takes its value away", () => {
    const { element, internal } = fixture();

    internal(0);
    expect(element.getAttribute("tabindex")).toBe("0");

    internal(null);
    expect(element.hasAttribute("tabindex")).toBe(false);
  });

  it("follows the value back and forth", () => {
    const { element, internal } = fixture();

    internal(0);
    expect(element.getAttribute("tabindex")).toBe("0");

    internal(-1);
    expect(element.getAttribute("tabindex")).toBe("-1");

    internal(0);
    expect(element.getAttribute("tabindex")).toBe("0");
  });

  it("stops writing once the author writes another value", () => {
    const { element, internal } = fixture();

    internal(-1);
    expect(element.getAttribute("tabindex")).toBe("-1");

    element.setAttribute("tabindex", "5");
    internal(0);

    expect(element.getAttribute("tabindex")).toBe("5");
  });

  it("stops writing once the author writes the value it would have written", () => {
    // The value stands still and the attribute changes hands all the same:
    // what makes it the author's is the write, not what the write left behind.
    const { element, internal } = fixture();

    internal(-1);
    expect(element.getAttribute("tabindex")).toBe("-1");

    element.setAttribute("tabindex", "-1");
    internal(0);

    expect(element.getAttribute("tabindex")).toBe("-1");
  });

  it("counts a write through the tabIndex property as the author's", () => {
    const { element, internal } = fixture();

    internal(-1);
    element.tabIndex = 5;
    internal(0);

    expect(element.getAttribute("tabindex")).toBe("5");
  });

  it("leaves the element alone for good while the author owns the attribute", () => {
    const { element, internal } = fixture();

    internal(-1);
    element.setAttribute("tabindex", "5");

    internal(0);
    internal(null);
    internal(-1);

    expect(element.getAttribute("tabindex")).toBe("5");
  });

  it("takes the attribute back when the author removes it, and restores the value at once", () => {
    const { element, internal } = fixture();

    internal(0);
    element.setAttribute("tabindex", "5");
    expect(element.getAttribute("tabindex")).toBe("5");

    element.removeAttribute("tabindex");

    expect(element.getAttribute("tabindex")).toBe("0");
  });

  it("restores the value it was given while the author owned the attribute", () => {
    const { element, internal } = fixture();

    internal(0);
    element.setAttribute("tabindex", "5");

    internal(-1);
    expect(element.getAttribute("tabindex")).toBe("5");

    element.removeAttribute("tabindex");
    expect(element.getAttribute("tabindex")).toBe("-1");
  });

  it("counts a value the rules for parsing integers refuse as no value at all", () => {
    const { element, internal } = fixture();

    element.setAttribute("tabindex", "nonsense");
    internal(-1);

    expect(element.getAttribute("tabindex")).toBe("-1");
  });

  it("takes the attribute back at once when the author writes no value at all over ours", () => {
    const { element, internal } = fixture();

    internal(-1);
    expect(element.getAttribute("tabindex")).toBe("-1");

    element.setAttribute("tabindex", "nonsense");

    expect(element.getAttribute("tabindex")).toBe("-1");
  });

  it("counts the integer a value begins with as the author's", () => {
    const { element, internal } = fixture();

    element.setAttribute("tabindex", "5px");
    internal(-1);

    expect(element.getAttribute("tabindex")).toBe("5px");
  });

  it("does not remove an attribute it never wrote", () => {
    const { element } = fixture('tabindex="5"');

    expect(element.getAttribute("tabindex")).toBe("5");
  });

  it("counts an attribute it was told about as the author's", () => {
    const element = document.createElement("div");
    element.setAttribute("tabindex", "5");
    document.body.appendChild(element);
    trash.push(element);

    // The value an element gives itself starts empty, as it does in an
    // element: nothing is written before the attribute has been announced.
    const internal = signal<number | null>(null);
    const attribute = tabindex(element, internal);
    attribute.announce();

    expect(element.getAttribute("tabindex")).toBe("5");

    internal(0);
    expect(element.getAttribute("tabindex")).toBe("5");

    element.removeAttribute("tabindex");
    attribute.announce();
    expect(element.getAttribute("tabindex")).toBe("0");
  });

  it("hears about the attribute from the element and nowhere else", () => {
    // An element that gives itself a value before it has announced the
    // attribute it carries writes over the author's, because as far as
    // anything here can tell there is nothing to write over. That is what
    // makes the value an element gives itself a value it only has once it is
    // connected: the announcement of a connection comes after the
    // announcement of every attribute an upgrade brings.
    const element = document.createElement("div");
    element.setAttribute("tabindex", "5");
    document.body.appendChild(element);
    trash.push(element);

    // Nothing announces the attribute: the controller is never told.
    tabindex(element, signal<number | null>(-1));

    expect(element.getAttribute("tabindex")).toBe("-1");
  });

  it("writes over an attribute whose value is no value at all", () => {
    const element = document.createElement("div");
    element.setAttribute("tabindex", "nonsense");
    document.body.appendChild(element);
    trash.push(element);

    tabindex(element, signal<number | null>(-1)).announce();

    expect(element.getAttribute("tabindex")).toBe("-1");
  });

  it("does not remove an attribute it never wrote whose value is no value at all", () => {
    const { element } = fixture('tabindex="nonsense"');

    expect(element.getAttribute("tabindex")).toBe("nonsense");
  });

  it("writes once when the author hands the attribute back", () => {
    const { element, internal } = fixture();

    internal(0);
    element.setAttribute("tabindex", "5");

    const observer = new MutationObserver(() => {});
    observer.observe(element, { attributeFilter: ["tabindex"] });

    element.removeAttribute("tabindex");

    // The author's own removal, and the one write that restores our value:
    // the value the author took away is never written back on the way there.
    const records = observer.takeRecords();
    observer.disconnect();

    expect(records.length).toBe(2);
    expect(element.getAttribute("tabindex")).toBe("0");
  });

  it("counts an attribute carried from markup as the author's", () => {
    const { element, internal } = fixture('tabindex="5"');

    internal(0);

    expect(element.getAttribute("tabindex")).toBe("5");
  });

  it("owns the attribute of an element upgraded without one", () => {
    const { element, internal } = fixture("id=upgraded-without-tabindex");

    internal(-1);

    expect(element.getAttribute("tabindex")).toBe("-1");
  });

  it("reports the tabindex value of the element", () => {
    const { element, attribute, internal } = fixture();

    expect(attribute()).toBeNull();

    internal(-1);
    expect(attribute()).toBe(-1);

    element.setAttribute("tabindex", "5");
    expect(attribute()).toBe(5);

    element.setAttribute("tabindex", "5px");
    expect(attribute()).toBe(5);

    element.removeAttribute("tabindex");
    expect(attribute()).toBe(-1);
  });
});
