import { describe, expect, it, vi } from "vitest";

import { queueElementTask, ToggleTaskTracker } from "../lib/toggle";

/**
 * An element with a listener that records the states of every toggle event
 * fired at it, and the tracker that fires them.
 */
function setup(): {
  element: HTMLElement;
  tracker: ToggleTaskTracker;
  events: string[];
} {
  const element = document.createElement("div");
  const events: string[] = [];

  element.addEventListener("toggle", (event) => {
    const { oldState, newState } = event as ToggleEvent;
    events.push(`${oldState}-${newState}`);
  });

  return { element, tracker: new ToggleTaskTracker(element), events };
}

/**
 * Resolves once every task queued before it has run.
 */
function drain(): Promise<void> {
  return new Promise<void>((resolve) => {
    queueElementTask(document.body, () => resolve());
  });
}

describe("ToggleTaskTracker", () => {
  it("fires a toggle event with the states it was given", async () => {
    const { tracker, events } = setup();

    tracker.queue("closed", "open");
    expect(events).toEqual([]);

    await drain();
    expect(events).toEqual(["closed-open"]);
  });

  it("fires the event at the element it was created for", async () => {
    const element = document.createElement("div");
    const listener = vi.fn();
    element.addEventListener("toggle", listener);

    new ToggleTaskTracker(element).queue("closed", "open");

    await drain();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]![0].target).toBe(element);
  });

  it("coalesces two toggles of one turn into one closed-closed event", async () => {
    const { tracker, events } = setup();

    tracker.queue("closed", "open");
    tracker.queue("open", "closed");

    await drain();
    expect(events).toEqual(["closed-closed"]);
  });

  it("coalesces three toggles of one turn into one closed-open event", async () => {
    const { tracker, events } = setup();

    tracker.queue("closed", "open");
    tracker.queue("open", "closed");
    tracker.queue("closed", "open");

    await drain();
    expect(events).toEqual(["closed-open"]);
  });

  it("coalesces a toggle queued from a microtask", async () => {
    const { tracker, events } = setup();

    tracker.queue("closed", "open");
    queueMicrotask(() => tracker.queue("open", "closed"));

    // Two drains, because the replacement task is queued from the microtask,
    // that is after the first drain has already taken its place in the queue.
    await drain();
    await drain();
    expect(events).toEqual(["closed-closed"]);
  });

  it("queues the replacement task at the tail of the task queue", async () => {
    const element = document.createElement("div");
    const order: string[] = [];
    element.addEventListener("toggle", () => order.push("toggle"));
    const tracker = new ToggleTaskTracker(element);

    tracker.queue("closed", "open");
    queueElementTask(document.body, () => order.push("competitor"));
    tracker.queue("open", "closed");

    await drain();
    expect(order).toEqual(["competitor", "toggle"]);
  });

  it("keeps no task once the event has been fired", async () => {
    const { tracker, events } = setup();

    tracker.queue("closed", "open");
    await drain();

    tracker.queue("open", "closed");
    await drain();

    expect(events).toEqual(["closed-open", "open-closed"]);
  });

  it("fires one event per turn of the event loop", async () => {
    const { tracker, events } = setup();

    tracker.queue("closed", "open");
    tracker.queue("open", "closed");
    await drain();

    tracker.queue("closed", "open");
    tracker.queue("open", "closed");
    await drain();

    expect(events).toEqual(["closed-closed", "closed-closed"]);
  });
});
