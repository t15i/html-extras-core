import { Internals } from "@t15i/webidl-decorators";
import type {
  BlinklikeHTMLCollection,
  BlinklikeHTMLCollectionData,
  CollectionRule,
} from "@t15i/htmlcollections";

/**
 * The store `collection` keeps: the root and the rule it was built from.
 *
 * @param collection - The collection.
 *
 * @returns Its store.
 */
function storeOf<E extends Element>(
  collection: HTMLCollectionOf<E>,
): BlinklikeHTMLCollectionData<E> {
  return (collection as BlinklikeHTMLCollection<E>)[Internals].data;
}

/**
 * The candidates of a rule under a root, in tree order.
 *
 * @param root - The root of the collection.
 * @param rule - The membership rule.
 *
 * @returns The elements the rule is asked about, in tree order.
 */
function* candidates(root: Element, rule: CollectionRule): Generator<Element> {
  if (rule.subtree !== true) {
    for (
      let child = root.firstElementChild;
      child !== null;
      child = child.nextElementSibling
    ) {
      yield child;
    }

    return;
  }

  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT,
  );

  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    yield node as Element;
  }
}

/**
 * The candidates of a rule under a root, in reverse tree order.
 *
 * @param root - The root of the collection.
 * @param rule - The membership rule.
 *
 * @returns The elements the rule is asked about, last one first.
 */
function* candidatesReversed(
  root: Element,
  rule: CollectionRule,
): Generator<Element> {
  if (rule.subtree !== true) {
    for (
      let child = root.lastElementChild;
      child !== null;
      child = child.previousElementSibling
    ) {
      yield child;
    }

    return;
  }

  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT,
  );

  while (walker.lastChild() !== null);

  for (
    let node: Node | null = walker.currentNode;
    node !== null && node !== root;
    node = walker.previousNode()
  ) {
    yield node as Element;
  }
}

/**
 * The candidates that follow `item`, in tree order.
 *
 * @param root - The root of the collection.
 * @param item - The candidate to start after.
 * @param rule - The membership rule.
 *
 * @returns The candidates after `item`, `item` itself excluded.
 */
function* candidatesAfter(
  root: Element,
  item: Element,
  rule: CollectionRule,
): Generator<Element> {
  if (rule.subtree !== true) {
    if (item.parentNode !== root) return;

    for (
      let sibling = item.nextElementSibling;
      sibling !== null;
      sibling = sibling.nextElementSibling
    ) {
      yield sibling;
    }

    return;
  }

  if (item === root || !root.contains(item)) return;

  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT,
  );
  walker.currentNode = item;

  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    yield node as Element;
  }
}

/**
 * The candidates that precede `item`, in reverse tree order.
 *
 * @param root - The root of the collection.
 * @param item - The candidate to start before.
 * @param rule - The membership rule.
 *
 * @returns The candidates before `item`, `item` itself excluded.
 */
function* candidatesBefore(
  root: Element,
  item: Element,
  rule: CollectionRule,
): Generator<Element> {
  if (rule.subtree !== true) {
    if (item.parentNode !== root) return;

    for (
      let sibling = item.previousElementSibling;
      sibling !== null;
      sibling = sibling.previousElementSibling
    ) {
      yield sibling;
    }

    return;
  }

  if (item === root || !root.contains(item)) return;

  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT,
  );
  walker.currentNode = item;

  for (
    let node = walker.previousNode();
    node !== null && node !== root;
    node = walker.previousNode()
  ) {
    yield node as Element;
  }
}

/**
 * The members of a collection, in tree order, from the start or from `item`.
 *
 * @param collection - The collection to walk.
 * @param item - The candidate to start after, which need not be a member
 *   itself. The walk starts at the first member when it is left out.
 *
 * @returns The members, in tree order.
 */
export function* forward<E extends Element>(
  collection: HTMLCollectionOf<E>,
  item?: Element,
): Generator<E> {
  const { root, rule } = storeOf(collection);

  const source =
    item === undefined
      ? candidates(root, rule)
      : candidatesAfter(root, item, rule);

  for (const candidate of source) {
    if (rule.matches(candidate)) yield candidate as E;
  }
}

/**
 * The members of a collection, in reverse tree order, from the end or from
 * `item`.
 *
 * @param collection - The collection to walk.
 * @param item - The candidate to start before, which need not be a member
 *   itself. The walk starts at the last member when it is left out.
 *
 * @returns The members, last one first.
 */
export function* backward<E extends Element>(
  collection: HTMLCollectionOf<E>,
  item?: Element,
): Generator<E> {
  const { root, rule } = storeOf(collection);

  const source =
    item === undefined
      ? candidatesReversed(root, rule)
      : candidatesBefore(root, item, rule);

  for (const candidate of source) {
    if (rule.matches(candidate)) yield candidate as E;
  }
}
