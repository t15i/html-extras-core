export {
  Argument,
  Attribute,
  Constructor,
  ExistingIndexedPropertySetter,
  Exposed,
  Interface,
  Internals,
  NewIndexedPropertySetter,
  Operation,
  Optional,
  Reflect,
  Setter,
} from "@t15i/webidl-decorators";
export {
  Boolean,
  DOMString,
  InterfaceType,
  Long,
  Nullable,
  Undefined,
  Union,
  UnsignedLong,
} from "@t15i/webidl-types";
export { Element } from "@t15i/webspecs/dom";
export {
  EnumeratedAttributeState,
  EnumeratedAttributeStates,
} from "@t15i/webspecs/html";
export {
  InterfaceObject,
  InterfacePrototypeObject,
} from "@t15i/webspecs/webidl";
// Both names collide with decorators of the same name, so they come out under
// names of their own.
export type {
  Operation as IDLOperation,
  RegularAttribute,
} from "@t15i/webspecs/webidl";
export * from "@t15i/htmlcollections";

export * from "./collections";
export * from "./connectivity";
// The primitives an element builds its state out of. The rest of the graph -
// computing off it, triggering it by hand, reading it without subscribing -
// is how the pieces below are written, not what an element writes.
export { effect, signal, watch } from "./reactive";
export type { ReadonlySignal, Signal } from "./reactive";
// Only the pair an element uses is public: the tick registry behind them and
// the link between a tick and a reference are how they talk to each other.
export { ref, refTarget } from "./ref";
export type { Reference, RefTargetOptions } from "./ref";
export * from "./share";
export * from "./suppression";
export * from "./tabindex";
// The task queue behind it is how a tracker gets its task to the DOM
// manipulation task source, not something an element asks for itself.
export { ToggleTaskTracker } from "./toggle";
