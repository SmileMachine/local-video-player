import { EventEmitter } from "events";

export class Reactive extends EventEmitter {
  constructor(value) {
    super();
    this._value = value;
  }

  get value() {
    return this._value;
  }

  set value(newValue) {
    const oldValue = this._value;
    this._value = newValue;
    this.emit("change", newValue, oldValue);
  }

  subscribe(callback) {
    this.on("change", callback);
    // returns the function that can unsubscribe the callback
    return () => this.off("change", callback);
  }
}

export function ref(initialValue) {
  return new Reactive(initialValue);
}
