import { noop } from '@codecb/ts-utils/function';
import { arrayOf } from '@codecb/ts-utils/list';
import { ClientRequest, IncomingMessage, InformationEvent } from 'node:http';
import { Socket } from 'node:net';
import { Readable } from 'node:stream';
import { RedirectableRequest } from './RedirectableRequest';

interface WritableEvents {
  close: () => void;
  drain: () => void;
  error: (err: Error) => void;
  finish: () => void;
  pipe: (src: Readable) => void;
  unpipe: (src: Readable) => void;
}

interface ClientRequestEvents {
  /**
   * @deprecated Listen for the `close` event instead.
   */
  // abort: () => void;
  connect: (response: IncomingMessage, socket: Socket, head: Buffer) => void;
  continue: () => void;
  information: (info: InformationEvent) => void;
  response: (res: IncomingMessage) => void;
  socket: (socket: Socket) => void;
  timeout: () => void;
  upgrade: (response: IncomingMessage, socket: Socket, head: Buffer) => void;
}

export interface Events extends WritableEvents, ClientRequestEvents {}

export type EventType = keyof Events;

const handledEvents = arrayOf<EventType>()([
  // 'abort',
  'connect',
  'error',
  'socket',
  'timeout',
]);

type HandledEvent = typeof handledEvents[number];

type Handlers = Pick<Events, HandledEvent> & ThisType<ClientRequest>;

export class EventHandlers {
  #handlers: Handlers;
  #requestMap = new WeakMap<ClientRequest, RedirectableRequest>();

  constructor() {
    const requestMap = new WeakMap<ClientRequest, RedirectableRequest>();
    this.#requestMap = requestMap;
    this.#handlers = {} as Handlers;
    handledEvents.forEach(
      event =>
        (this.#handlers[event] = function (this: ClientRequest, ...args) {
          return requestMap.get(this)?.emit(event, ...args);
        } as () => void),
    );
  }

  destroyRequest(request: ClientRequest) {
    handledEvents.forEach(event =>
      request.removeListener(event, this.#handlers[event]),
    );
    request.on('error', noop);
    request.destroy();
    this.#requestMap.delete(request);
  }

  registerRequest(
    request: ClientRequest,
    redirectableRequest: RedirectableRequest,
  ) {
    this.#requestMap.set(request, redirectableRequest);
    handledEvents.forEach(event =>
      request.addListener(event, this.#handlers[event]),
    );
  }
}

declare module 'node:http' {
  interface ClientRequest {
    removeListener<Event extends EventType>(
      event: Event,
      listener: Events[Event],
    ): this;
    removeListener(
      event: string | symbol,
      listener: (...args: any[]) => void,
    ): this;
  }
}
