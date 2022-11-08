import { Tail } from '@codecb/ts-utils/list';
import EventEmitter from 'eventemitter3';
import { BaseErrorCallback } from './types.js';

export abstract class BaseProxy<
  ErrorCallback extends BaseErrorCallback,
  EventTypes extends { error: ErrorCallback },
> extends EventEmitter<EventTypes> {
  constructor() {
    super();
    (this as EventEmitter<{ error: BaseErrorCallback }>).on('error', err =>
      this.onError(err),
    );
  }

  protected emitMissingTarget(...args: Tail<Parameters<ErrorCallback>>) {
    (this as EventEmitter<{ error: BaseErrorCallback }>).emit(
      'error',
      new Error(`Must provide a proper URL as target`),
      ...args,
    );
  }

  private onError(err: Error) {
    // NOTE: replicate Node core behavior using eventemitter3 so we force people to handle their own errors
    if (
      (this as EventEmitter<{ error: BaseErrorCallback }>).listeners('error')
        .length === 1
    )
      throw err;
  }
}
