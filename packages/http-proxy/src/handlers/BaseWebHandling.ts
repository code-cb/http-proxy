export type WebHandler = () => boolean | void;

export abstract class BaseWebHandling {
  protected abstract handlers: readonly WebHandler[];

  handle() {
    for (const handle of this.handlers) {
      if (handle.call(this)) break;
    }
  }
}
