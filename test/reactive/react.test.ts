import { describe, expect, it, vi } from "vitest";

import { cell, react } from "../../lib/reactive";

describe("react()", () => {
  it("runs on nothing where it is set up", () => {
    const steps = vi.fn();

    react(cell(1), steps);

    expect(steps).not.toHaveBeenCalled();
  });

  it("runs on an announcement, with what the source carries", () => {
    const source = cell(1);
    const steps = vi.fn();

    react(source, steps);
    source.set(2);

    expect(steps).toHaveBeenCalledExactlyOnceWith(2);
  });

  it("runs on an announcement that carries what it carried before", () => {
    const source = cell(1);
    const steps = vi.fn();

    react(source, steps);
    source.set(1);

    expect(steps).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("runs once per announcement", () => {
    const source = cell(1);
    const steps = vi.fn();

    react(source, steps);
    source.set(2);
    source.set(3);

    expect(steps).toHaveBeenCalledTimes(2);
  });

  it("undoes a run before the next one", () => {
    const source = cell(1);
    const log: string[] = [];

    react(source, (value) => {
      log.push(`do ${value}`);
      return () => log.push(`undo ${value}`);
    });
    source.set(2);
    source.set(3);

    expect(log).toEqual(["do 2", "undo 2", "do 3"]);
  });

  it("undoes the last run when it stops", () => {
    const source = cell(1);
    const log: string[] = [];

    const stop = react(source, (value) => {
      log.push(`do ${value}`);
      return () => log.push(`undo ${value}`);
    });
    source.set(2);
    stop();

    expect(log).toEqual(["do 2", "undo 2"]);
  });

  it("runs on nothing once it is stopped", () => {
    const source = cell(1);
    const steps = vi.fn();

    const stop = react(source, steps);
    stop();
    source.set(2);

    expect(steps).not.toHaveBeenCalled();
  });

  it("subscribes to nothing the steps read", () => {
    const source = cell(1);
    const other = cell("a");
    const steps = vi.fn(() => {
      other();
    });

    react(source, steps);
    source.set(2);
    other.set("b");

    expect(steps).toHaveBeenCalledTimes(1);
  });
});
