import { EventEmitter } from '@codecb/event-emitter';
import { Tail } from '@codecb/ts-utils/list';
import { BaseErrorCallback, BaseProxyEventEmitter } from './types.js';

export abstract class BaseProxy<
  ErrorCallback extends BaseErrorCallback,
  EventTypes extends { error: ErrorCallback },
> extends EventEmitter<EventTypes> {
  constructor() {
    super();
    (this as BaseProxyEventEmitter).on('error', err => this.onError(err));
  }

  protected emitMissingTarget(...args: Tail<Parameters<ErrorCallback>>) {
    (this as BaseProxyEventEmitter).emit(
      'error',
      new Error(`Must provide a proper URL as target`),
      ...args,
    );
  }

  private onError(err: Error) {
    // NOTE: replicate Node core behavior using eventemitter3 so we force people to handle their own errors
    if ((this as BaseProxyEventEmitter).listeners('error').length === 1)
      throw err;
  }
}
