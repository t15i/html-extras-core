import { afterEach, describe, expect, it, vi } from "vitest";

import { connectivity } from "../lib/connectivity";

const trash: Element[] = [];
afterEach(() => {
  while (trash.length) trash.pop()!.remove();
});

/**
 * An element to hang a connection on, cleaned up after the test.
 *
 * @returns The element, out of the document.
 */
function element(): HTMLElement {
  const created = document.createElement("div");
  trash.push(created);
  return created;
}

describe("connectivity()", () => {
  it("starts out of a document", () => {
    const { connected: signal, root } = connectivity(element());

    expect(signal()).toBe(false);
    expect(root()).toBe(null);
  });

  it("answers with the root of the element once it says it is connected", () => {
    const subject = element();
    const { connected: signal, root } = connectivity(subject);

    document.body.appendChild(subject);
    signal(true);

    expect(root()).toBe(document);

    signal(false);

    expect(root()).toBe(null);
  });

  it("answers with a shadow root as readily as with a document", () => {
    const host = element();
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const subject = document.createElement("div");
    shadow.appendChild(subject);

    const { connected: signal, root } = connectivity(subject);
    signal(true);

    expect(root()).toBe(shadow);
  });

  it("calls a connected subscriber on every connection and nowhere else", () => {
    const { connected: signal, mount } = connectivity(element());
    const callback = vi.fn();

    mount(callback);
    expect(callback).not.toHaveBeenCalled();

    signal(true);
    expect(callback).toHaveBeenCalledTimes(1);

    signal(false);
    expect(callback).toHaveBeenCalledTimes(1);

    signal(true);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("calls a disconnected subscriber on every disconnection", () => {
    const { connected: signal, unmount } = connectivity(element());
    const callback = vi.fn();

    unmount(callback);
    signal(true);
    expect(callback).not.toHaveBeenCalled();

    signal(false);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("calls nothing for a write that changes nothing", () => {
    const { connected: signal, mount, unmount } = connectivity(element());
    const onConnected = vi.fn();
    const onDisconnected = vi.fn();

    mount(onConnected);
    unmount(onDisconnected);

    signal(false);
    expect(onConnected).not.toHaveBeenCalled();
    expect(onDisconnected).not.toHaveBeenCalled();

    signal(true);
    signal(true);
    expect(onConnected).toHaveBeenCalledTimes(1);
  });

  it("stops calling a subscriber that has been stopped", () => {
    const { connected: signal, mount } = connectivity(element());
    const callback = vi.fn();

    const stop = mount(callback);
    signal(true);
    expect(callback).toHaveBeenCalledTimes(1);

    stop();
    signal(false);
    signal(true);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("keeps subscribers of the two edges apart", () => {
    const { connected: signal, mount, unmount } = connectivity(element());
    const order: string[] = [];

    mount(() => order.push("connected"));
    unmount(() => order.push("disconnected"));

    signal(true);
    signal(false);
    signal(true);

    expect(order).toEqual(["connected", "disconnected", "connected"]);
  });
});
