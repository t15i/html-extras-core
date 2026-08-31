import { describe, expect, it, vi } from "vitest";

import { cell, computed, effect } from "../../lib/reactive";

describe("cell()", () => {
  it("carries the value it was made with", () => {
    expect(cell(1)()).toBe(1);
  });

  it("carries the value it was given", () => {
    const value = cell(1);

    value.set(2);

    expect(value()).toBe(2);
  });

  it("announces itself to nobody when it is made", () => {
    const steps = vi.fn();

    effect(() => {
      cell(1);
      steps();
    });

    expect(steps).toHaveBeenCalledTimes(1);
  });

  it("announces a write to a reader", () => {
    const value = cell(1);
    const steps = vi.fn();

    effect(() => {
      value();
      steps();
    });
    value.set(2);

    expect(steps).toHaveBeenCalledTimes(2);
  });

  it("announces a write that leaves the value it found", () => {
    const value = cell(1);
    const steps = vi.fn();

    effect(() => {
      value();
      steps();
    });
    value.set(1);

    expect(steps).toHaveBeenCalledTimes(2);
  });

  it("announces through a derived value that did not change", () => {
    const value = cell("-1");
    const parsed = computed(() => Number.parseInt(value(), 10));
    const steps = vi.fn();

    effect(() => {
      value();
      parsed();
      steps();
    });
    value.set("-1nonsense");

    expect(parsed()).toBe(-1);
    expect(steps).toHaveBeenCalledTimes(2);
  });

  it("says nothing to a reader that stopped reading", () => {
    const value = cell(1);
    const steps = vi.fn();

    const stop = effect(() => {
      value();
      steps();
    });
    stop();
    value.set(2);

    expect(steps).toHaveBeenCalledTimes(1);
  });
});
