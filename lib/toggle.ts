/**
 * The sequence number the next queued task takes.
 */
let sequence = 0;

/**
 * The steps of every queued task that has neither run nor been cancelled,
 * keyed by the sequence number that identifies it in the message queue.
 */
const queued = new Map<number, () => void>();

/**
 * The channel whose message queue stands in for the DOM manipulation task
 * source.
 */
const channel = new MessageChannel();

channel.port1.onmessage = (event: MessageEvent<number>): void => {
  const steps = queued.get(event.data);
  queued.delete(event.data);
  steps?.();
};

/**
 * A handle on a task queued with {@link queueElementTask}.
 */
export interface ElementTask {
  /**
   * Removes the task from its task queue.
   */
  cancel(): void;
}

/**
 * Queues a task that runs `steps` given `element`.
 *
 * @param element - The element the task is queued for. It is passed on to
 *   `steps`, and nothing else is done with it.
 * @param steps - The steps the task runs.
 *
 * @returns A handle that cancels the task.
 *
 * @see https://html.spec.whatwg.org/multipage/webappapis.html#queue-an-element-task
 */
export function queueElementTask<E extends Element>(
  element: E,
  steps: (element: E) => void,
): ElementTask {
  const current = sequence++;

  queued.set(current, () => steps(element));
  channel.port2.postMessage(current);

  return {
    cancel(): void {
      queued.delete(current);
    },
  };
}

/**
 * The toggle task tracker of an element: the queued toggle event task and the
 * old state it was queued with.
 *
 * @see https://html.spec.whatwg.org/multipage/interactive-elements.html#queue-a-details-toggle-event-task
 */
export class ToggleTaskTracker {
  /**
   * Creates a tracker for `element`.
   *
   * @param element - The element toggle events are fired at.
   */
  constructor(element: Element) {
    this.#element = element;
  }

  /**
   * Queues a toggle event task, given `oldState` and `newState`.
   *
   * @param oldState - The state the element is leaving.
   * @param newState - The state the element is entering.
   */
  queue(oldState: string, newState: string): void {
    if (this.#task !== null) {
      oldState = this.#oldState;
      this.#task.cancel();
      this.#task = null;
    }

    this.#task = queueElementTask(this.#element, (element) => {
      element.dispatchEvent(new ToggleEvent("toggle", { oldState, newState }));
      this.#task = null;
    });
    this.#oldState = oldState;
  }

  /**
   * The element toggle events are fired at.
   */
  readonly #element: Element;

  /**
   * The queued toggle event task, or null when there is none.
   */
  #task: ElementTask | null = null;

  /**
   * The old state the queued task was queued with.
   */
  #oldState: string = "";
}
