import { afterEach, describe, expect, it } from "vitest";

import { backward, forward } from "../lib/collections";
import { BlinklikeHTMLCollection, CollectionRule } from "../lib/index";

const trash: Element[] = [];
afterEach(() => {
  while (trash.length) trash.pop()!.remove();
});

/**
 * Membership of the direct `b` children of the root.
 */
const CHILDREN = new CollectionRule({
  matches: (element) => element.localName === "b",
});

/**
 * The same membership, drawn from the whole subtree.
 */
const SUBTREE = new CollectionRule({
  matches: (element) => element.localName === "b",
  subtree: true,
});

/**
 * Markup in the document, cleaned up after the test.
 *
 * @param html - The markup.
 *
 * @returns The root it was parsed into.
 */
function fixture(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.appendChild(root);
  trash.push(root);
  return root;
}

const ids = (members: Iterable<Element>): string[] =>
  [...members].map((member) => member.id);

/**
 * The collection of `rule` under `root`, which is what the walks take.
 */
const collect = (
  root: Element,
  rule: CollectionRule,
): BlinklikeHTMLCollection => new BlinklikeHTMLCollection(root, rule);

describe("forward over a whole collection", () => {
  it("yields the members of a children rule in tree order", () => {
    const root = fixture(`
      <b id="a"></b><i id="skipped"></i><b id="b"></b><b id="c"></b>
    `);

    expect(ids(forward(collect(root, CHILDREN)))).toEqual(["a", "b", "c"]);
  });

  it("leaves a member of a deeper level out of a children rule", () => {
    const root = fixture(`<b id="a"></b><i><b id="nested"></b></i>`);

    expect(ids(forward(collect(root, CHILDREN)))).toEqual(["a"]);
  });

  it("reaches every level under a subtree rule, in tree order", () => {
    const root = fixture(`
      <b id="a"><b id="inner"></b></b><i><b id="nested"></b></i>
    `);

    expect(ids(forward(collect(root, SUBTREE)))).toEqual([
      "a",
      "inner",
      "nested",
    ]);
  });

  it("yields nothing for a root with no members", () => {
    const root = fixture(`<i></i>`);

    expect(ids(forward(collect(root, CHILDREN)))).toEqual([]);
    expect(ids(forward(collect(root, SUBTREE)))).toEqual([]);
  });

  it("reads the tree as it walks rather than snapshotting it", () => {
    const root = fixture(`<b id="a"></b><b id="b"></b>`);
    const seen: string[] = [];

    for (const member of forward(collect(root, CHILDREN))) {
      seen.push(member.id);
      if (member.id === "a") {
        const arriving = document.createElement("b");
        arriving.id = "arriving";
        root.appendChild(arriving);
      }
    }

    expect(seen).toEqual(["a", "b", "arriving"]);
  });

  it("stops walking as soon as the caller stops asking", () => {
    const root = fixture(`<b id="a"></b><b id="b"></b><b id="c"></b>`);
    let asked = 0;
    const counted = new CollectionRule({
      matches(element: Element): boolean {
        asked++;
        return CHILDREN.matches(element);
      },
    });

    for (const member of forward(collect(root, counted))) {
      if (member.id === "a") break;
    }

    expect(asked).toBe(1);
  });
});

describe("backward over a whole collection", () => {
  it("yields the members of a children rule last one first", () => {
    const root = fixture(`
      <b id="a"></b><i id="skipped"></i><b id="b"></b><b id="c"></b>
    `);

    expect(ids(backward(collect(root, CHILDREN)))).toEqual(["c", "b", "a"]);
  });

  it("leaves a member of a deeper level out of a children rule", () => {
    const root = fixture(`<b id="a"></b><i><b id="nested"></b></i>`);

    expect(ids(backward(collect(root, CHILDREN)))).toEqual(["a"]);
  });

  it("reaches every level under a subtree rule, in reverse tree order", () => {
    const root = fixture(`
      <b id="a"><b id="inner"></b></b><i><b id="nested"></b></i>
    `);

    expect(ids(backward(collect(root, SUBTREE)))).toEqual([
      "nested",
      "inner",
      "a",
    ]);
  });

  it("yields nothing for a root with no members", () => {
    const root = fixture(`<i></i>`);

    expect(ids(backward(collect(root, CHILDREN)))).toEqual([]);
    expect(ids(backward(collect(root, SUBTREE)))).toEqual([]);
  });

  it("answers the last member without walking the ones before it", () => {
    const root = fixture(`<b id="a"></b><b id="b"></b><b id="c"></b>`);
    let asked = 0;
    const counted = new CollectionRule({
      matches(element: Element): boolean {
        asked++;
        return CHILDREN.matches(element);
      },
    });

    expect(backward(collect(root, counted)).next().value?.id).toBe("c");
    expect(asked).toBe(1);
  });
});

describe("forward from a member", () => {
  it("yields the members after the item, in tree order", () => {
    const root = fixture(
      `<b id="a"></b><b id="b"></b><i></i><b id="c"></b><b id="d"></b>`,
    );
    const b = root.querySelector("#b")!;

    expect(ids(forward(collect(root, CHILDREN), b))).toEqual(["c", "d"]);
  });

  it("starts after an item that is no member itself", () => {
    const root = fixture(`<b id="a"></b><i id="between"></i><b id="b"></b>`);
    const between = root.querySelector("#between")!;

    expect(ids(forward(collect(root, CHILDREN), between))).toEqual(["b"]);
  });

  it("continues into the subtree of the item under a subtree rule", () => {
    const root = fixture(`
      <b id="a"><b id="inner"></b></b><b id="b"></b>
    `);
    const a = root.querySelector("#a")!;

    expect(ids(forward(collect(root, SUBTREE), a))).toEqual(["inner", "b"]);
  });

  it("yields nothing after the last member", () => {
    const root = fixture(`<b id="a"></b><b id="b"></b>`);
    const b = root.querySelector("#b")!;

    expect(ids(forward(collect(root, CHILDREN), b))).toEqual([]);
    expect(ids(forward(collect(root, SUBTREE), b))).toEqual([]);
  });

  it("yields nothing for an item that is no candidate of the root", () => {
    const root = fixture(`<b id="a"></b><i><b id="nested"></b></i>`);
    const nested = root.querySelector("#nested")!;
    const stranger = document.createElement("b");

    expect(ids(forward(collect(root, CHILDREN), nested))).toEqual([]);
    expect(ids(forward(collect(root, SUBTREE), stranger))).toEqual([]);
    expect(ids(forward(collect(root, SUBTREE), root))).toEqual([]);
  });
});

describe("backward from a member", () => {
  it("yields the members before the item, in reverse tree order", () => {
    const root = fixture(`<b id="a"></b><b id="b"></b><i></i><b id="c"></b>`);
    const c = root.querySelector("#c")!;

    expect(ids(backward(collect(root, CHILDREN), c))).toEqual(["b", "a"]);
  });

  it("starts before an item that is no member itself", () => {
    const root = fixture(`<b id="a"></b><i id="between"></i><b id="b"></b>`);
    const between = root.querySelector("#between")!;

    expect(ids(backward(collect(root, CHILDREN), between))).toEqual(["a"]);
  });

  it("walks out of a subtree without reaching past the root", () => {
    const root = fixture(`
      <b id="a"><b id="inner"></b></b><b id="b"></b>
    `);
    const b = root.querySelector("#b")!;

    expect(ids(backward(collect(root, SUBTREE), b))).toEqual(["inner", "a"]);
  });

  it("yields nothing before the first member", () => {
    const root = fixture(`<b id="a"></b><b id="b"></b>`);
    const a = root.querySelector("#a")!;

    expect(ids(backward(collect(root, CHILDREN), a))).toEqual([]);
    expect(ids(backward(collect(root, SUBTREE), a))).toEqual([]);
  });

  it("yields nothing for an item that is no candidate of the root", () => {
    const root = fixture(`<b id="a"></b><i><b id="nested"></b></i>`);
    const nested = root.querySelector("#nested")!;
    const stranger = document.createElement("b");

    expect(ids(backward(collect(root, CHILDREN), nested))).toEqual([]);
    expect(ids(backward(collect(root, SUBTREE), stranger))).toEqual([]);
    expect(ids(backward(collect(root, SUBTREE), root))).toEqual([]);
  });
});

describe("walking a collection in a tree of its own", () => {
  it("holds wherever the root is", () => {
    const root = document.createElement("div");
    root.innerHTML = `<b id="a"></b><b id="b"></b>`;
    const a = root.querySelector("#a")!;

    expect(ids(forward(collect(root, CHILDREN)))).toEqual(["a", "b"]);
    expect(ids(forward(collect(root, CHILDREN), a))).toEqual(["b"]);
  });
});
