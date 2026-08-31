import { afterEach, describe, expect, it } from "vitest";

import { styled } from "../../lib/reactive/styled";
import { signal, type Signal } from "../../lib/reactive";

const trash: Element[] = [];
afterEach(() => {
  while (trash.length) trash.pop()!.remove();
  document.adoptedStyleSheets = [];
});

/**
 * A sheet of its own, so that one test never sees the sheet of another.
 *
 * @returns The sheet.
 */
function sheet(): CSSStyleSheet {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync("tab-panel { display: block }");
  return sheet;
}

/**
 * A shadow root in the document.
 *
 * @returns The root.
 */
function shadow(): ShadowRoot {
  const host = document.createElement("div");
  document.body.appendChild(host);
  trash.push(host);

  return host.attachShadow({ mode: "open" });
}

/**
 * The root signal of an element that is in `node`.
 *
 * @param node - The root, or null for an element that has none.
 *
 * @returns The signal.
 */
const root = (node: Node | null): Signal<Node | null> =>
  signal<Node | null>(node);

describe("styled()", () => {
  it("puts the sheet into the document", () => {
    const style = sheet();

    styled(style, { root: root(document) });

    expect(document.adoptedStyleSheets).toContain(style);
  });

  it("puts the sheet into a shadow root", () => {
    const style = sheet();
    const shadowRoot = shadow();

    styled(style, { root: root(shadowRoot) });

    expect(shadowRoot.adoptedStyleSheets).toContain(style);
  });

  it("puts nothing anywhere while the element has no root", () => {
    styled(sheet(), { root: root(null) });

    expect(document.adoptedStyleSheets).toHaveLength(0);
  });

  it("does not put the sheet into one root twice", () => {
    const style = sheet();

    styled(style, { root: root(document) });
    styled(style, { root: root(document) });

    expect(document.adoptedStyleSheets).toHaveLength(1);
  });

  it("puts the sheet into every root the element is in", () => {
    const style = sheet();
    const shadowRoot = shadow();
    const where = root(document);

    styled(style, { root: where });
    where(shadowRoot);

    expect(document.adoptedStyleSheets).toContain(style);
    expect(shadowRoot.adoptedStyleSheets).toContain(style);
  });

  it("leaves the sheet in a root the element has left", () => {
    const style = sheet();
    const where = root(document);

    styled(style, { root: where });
    where(null);

    expect(document.adoptedStyleSheets).toContain(style);
  });

  it("puts the sheet back when the author dropped it", () => {
    const style = sheet();
    const where = root(document);

    styled(style, { root: where });
    document.adoptedStyleSheets = [];
    where(null);
    where(document);

    expect(document.adoptedStyleSheets).toContain(style);
  });

  it("keeps the sheet of the author when it adds its own", () => {
    const style = sheet();
    const authored = sheet();
    document.adoptedStyleSheets = [authored];

    styled(style, { root: root(document) });

    expect(document.adoptedStyleSheets).toHaveLength(2);
    expect(document.adoptedStyleSheets[0]).toBe(authored);
    expect(document.adoptedStyleSheets[1]).toBe(style);
  });

  it("puts the sheet nowhere once it is stopped", () => {
    const style = sheet();
    const where = root(null);

    styled(style, { root: where })();
    where(document);

    expect(document.adoptedStyleSheets).toHaveLength(0);
  });
});
