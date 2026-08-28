import { describe, expect, it, vi } from "vitest";

import { signal, watch } from "../../lib/reactive";

describe("watch()", () => {
  it("calls back with the initial value and no old value", () => {
    const source = signal(1);
    const cb = vi.fn();

    watch(source, cb);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(1, undefined);
  });

  it("calls back with the new value and the old one", () => {
    const source = signal(1);
    const cb = vi.fn();

    watch(source, cb);
    source(2);

    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenLastCalledWith(2, 1);
  });

  it("does not call back when the value has not changed", () => {
    const tick = signal(0);
    const cb = vi.fn();

    watch(() => {
      tick();
      return "same";
    }, cb);
    expect(cb).toHaveBeenCalledTimes(1);

    tick(1);

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("runs the callback untracked", () => {
    const source = signal(1);
    const other = signal("a");
    const cb = vi.fn(() => {
      other();
    });

    watch(source, cb);
    other("b");

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("stops watching once it is stopped", () => {
    const source = signal(1);
    const cb = vi.fn();

    const stop = watch(source, cb);
    stop();
    source(2);

    expect(cb).toHaveBeenCalledTimes(1);
  });
});
