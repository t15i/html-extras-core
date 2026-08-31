export type ReadonlySignal<T> = () => T;

export type Signal<T> = {
  (value: T): void;
  (): T;
};
