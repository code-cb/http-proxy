import { WebHandler } from './types.js';

export abstract class BaseHandling {
  protected abstract handlers: readonly WebHandler[];

  handle() {
    for (const handle of this.handlers) {
      if (handle.call(this)) break;
    }
  }
}
