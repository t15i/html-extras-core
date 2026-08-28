import { describe, expect, it } from "vitest";

import { share } from "../lib/share";

describe("share()", () => {
  it("returns what was shared for an element", () => {
    const channel = share<HTMLElement, { value: number }>();
    const element = document.createElement("div");
    const data = { value: 1 };

    channel.share(element, data);

    expect(channel.shared(element)).toBe(data);
  });

  it("keeps the data of each element apart", () => {
    const channel = share<HTMLElement, { value: number }>();
    const first = document.createElement("div");
    const second = document.createElement("div");

    channel.share(first, { value: 1 });
    channel.share(second, { value: 2 });

    expect(channel.shared(first).value).toBe(1);
    expect(channel.shared(second).value).toBe(2);
  });

  it("replaces the data of an element that shares twice", () => {
    const channel = share<HTMLElement, { value: number }>();
    const element = document.createElement("div");

    channel.share(element, { value: 1 });
    channel.share(element, { value: 2 });

    expect(channel.shared(element).value).toBe(2);
  });

  it("keeps channels apart", () => {
    const first = share<HTMLElement, { value: number }>();
    const second = share<HTMLElement, { value: number }>();
    const element = document.createElement("div");

    first.share(element, { value: 1 });

    expect(first.shared(element).value).toBe(1);
    expect(second.shared(element)).toBeUndefined();
  });
});
