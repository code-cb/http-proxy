import { VoidFunc } from '@codecb/ts-utils/function';
import {
  ClientRequest,
  IncomingMessage,
  OutgoingHttpHeader,
  OutgoingHttpHeaders,
  request as httpRequest,
  RequestOptions,
} from 'node:http';
import { request as httpsRequest } from 'node:https';
import { Socket } from 'node:net';
import { Writable } from 'node:stream';
import { Errors } from './errors';
import { EventHandlers, Events, EventType } from './events';
import { SanitizedOptions, sanitizeOptions } from './options';

type WriteCallback = (err?: Error | null) => void;

interface InternalBuffer {
  data: string | Buffer | Uint8Array;
  encoding: BufferEncoding | undefined;
}

const nativeRequestFns: Record<
  string,
  (
    options: RequestOptions,
    callback: (res: IncomingMessage) => void,
  ) => ClientRequest
> = {
  'http:': httpRequest,
  'https:': httpsRequest,
};

const eventHandlers = new EventHandlers();

export class RedirectableRequest extends Writable implements ClientRequest {
  #ended = false;
  #ending = false;
  host: string;
  #nativeRequest: ClientRequest;
  protocol: string;
  readonly #redirects = new Array<unknown>();
  readonly #requestBodyBuffers = new Array<InternalBuffer>();
  reusedSocket: boolean;
  maxHeadersCount: number;
  method: string;
  readonly #options: SanitizedOptions;
  path: string;
  #timeoutId: NodeJS.Timeout | undefined;

  get aborted(): boolean {
    return this.#nativeRequest.aborted;
  }

  get connection(): Socket | null {
    return this.#nativeRequest.connection;
  }

  get socket(): Socket | null {
    return this.#nativeRequest.socket;
  }

  get #requestBodyLength() {
    return this.#requestBodyBuffers.reduce(
      (len, { data }) => len + data.length,
      0,
    );
  }

  constructor(
    options: RequestOptions,
    callback?: (res: IncomingMessage) => void,
  ) {
    super();
    this.#options = sanitizeOptions(options);
    if (callback) this.addListener('response', callback);
    this.#nativeRequest = this.#performRequest();
  }

  abort(): void {
    this.destroy();
  }

  override destroy(error?: Error | undefined): this {
    abortRequest(this.#nativeRequest);
    return super.destroy(error);
  }

  override end(callback?: VoidFunc | undefined): this;
  override end(data: any, callback?: VoidFunc | undefined): this;
  override end(
    data: any,
    encoding: BufferEncoding,
    callback?: VoidFunc | undefined,
  ): this;
  override end(
    arg0?: string | Buffer | Uint8Array | VoidFunc,
    arg1?: BufferEncoding | VoidFunc,
    arg2?: VoidFunc,
  ): this {
    const { callback, data, encoding } =
      arg0 instanceof Function
        ? { callback: arg0, data: undefined, encoding: undefined }
        : arg1 instanceof Function
        ? { callback: arg1, data: arg0, encoding: undefined }
        : { callback: arg2, data: arg0, encoding: arg1 };

    if (!data) {
      this.#ended = this.#ending = true;
      this.#nativeRequest.end(callback);
    } else {
      this.write(data, encoding!, () => {
        this.#ended = true;
        this.#nativeRequest.end(callback);
      });
    }

    return this;
  }

  flushHeaders(): void {
    return this.#nativeRequest.flushHeaders();
  }

  getHeader(name: string): string | number | string[] | undefined {
    return this.#nativeRequest.getHeader(name);
  }

  onSocket(socket: Socket): void {
    throw new Error('Method not implemented.');
  }

  removeHeader(name: string): void {
    delete this.#options.headers[name];
    this.#nativeRequest.removeHeader(name);
  }

  setHeader(name: string, value: string | number | readonly string[]): this {
    this.#options.headers[name] = value as OutgoingHttpHeader;
    this.#nativeRequest.setHeader(name, value);
    return this;
  }

  setNoDelay(noDelay?: boolean | undefined): void {
    return this.#nativeRequest.setNoDelay(noDelay);
  }

  setSocketKeepAlive(
    enable?: boolean | undefined,
    initialDelay?: number | undefined,
  ): void {
    return this.#nativeRequest.setSocketKeepAlive(enable, initialDelay);
  }

  setTimeout(timeout: number, callback?: VoidFunc | undefined): this {
    const destroySocketOnTimeout = (socket: Socket) =>
      socket.setTimeout(timeout, socket.destroy);

    const startTimer = (socket: Socket) => {
      clearTimeout(this.#timeoutId);
      this.#timeoutId = setTimeout(() => {
        this.emit('timeout');
        clearTimer();
      }, timeout);
      destroySocketOnTimeout(socket);
    };

    const clearTimer = () => {
      clearTimeout(this.#timeoutId);
      this.removeListener('close', clearTimer);
      this.removeListener('error', clearTimer);
      this.removeListener('response', clearTimer);
      if (callback) this.removeListener('timeout', callback);
      if (!this.socket)
        this.#nativeRequest.removeListener('socket', startTimer);
    };

    if (callback) this.addListener('timeout', callback);

    if (this.socket) startTimer(this.socket);
    else this.#nativeRequest.once('socket', startTimer);

    this.addListener('socket', destroySocketOnTimeout);
    this.addListener('close', clearTimer);
    this.addListener('error', clearTimer);
    this.addListener('response', clearTimer);

    return this;
  }

  getRawHeaderNames(): string[] {
    throw new Error('Method not implemented.');
  }
  req: IncomingMessage;
  chunkedEncoding: boolean;
  shouldKeepAlive: boolean;
  useChunkedEncodingByDefault: boolean;
  sendDate: boolean;
  finished: boolean;
  headersSent: boolean;

  getHeaders(): OutgoingHttpHeaders {
    throw new Error('Method not implemented.');
  }
  getHeaderNames(): string[] {
    throw new Error('Method not implemented.');
  }
  hasHeader(name: string): boolean {
    throw new Error('Method not implemented.');
  }
  addTrailers(
    headers: OutgoingHttpHeaders | readonly [string, string][],
  ): void {
    throw new Error('Method not implemented.');
  }

  override write(data: any, callback?: WriteCallback): boolean;
  override write(
    data: any,
    encoding: BufferEncoding,
    callback?: WriteCallback,
  ): boolean;
  override write(
    data: unknown,
    arg1?: WriteCallback | BufferEncoding,
    arg2?: WriteCallback,
  ): boolean {
    if (this.#ending) throw new Errors.WriteAfterEnd();

    if (
      typeof data !== 'string' &&
      !Buffer.isBuffer(data) &&
      !(data instanceof Uint8Array)
    )
      throw new TypeError('data should be a string, Buffer or Uint8Array');

    const { callback, encoding } =
      arg1 instanceof Function
        ? { callback: arg1, encoding: undefined }
        : { callback: arg2, encoding: arg1 };

    /**
     * Ignore empty buffers, since writing them doesn't invoke the
     * callback: https://github.com/nodejs/node/issues/22066
     */
    if (data.length === 0) {
      callback?.();
      return false;
    }

    if (this.#requestBodyLength + data.length > this.#options.maxBodyLength) {
      this.destroy(new Errors.OversizedRequestBody());
      return false;
    }

    this.#requestBodyBuffers.push({ data, encoding });
    return this.#nativeRequest.write(data, encoding!, callback);
  }

  // TODO:
  /**
   * Executes the next native request (initial or redirect)
   */
  #performRequest() {
    const { protocol } = this.#options;
    const requestFn = nativeRequestFns[protocol];
    if (!requestFn) throw new TypeError(`Unsupported protocol ${protocol}`);
    const request = requestFn(this.#options, res => this.#processResponse(res));
    eventHandlers.registerRequest(request, this);
    URL.
    return request;
  }

  #processResponse(res: IncomingMessage) {}
}

export interface RedirectableRequest {
  addListener<Event extends EventType>(
    event: Event,
    listener: Events[Event],
  ): this;
  addListener(event: string | symbol, listener: (...args: any[]) => void): this;
  emit<Event extends EventType>(
    event: Event,
    ...args: Parameters<Events[Event]>
  ): boolean;
  emit(event: string | symbol, ...args: any[]): boolean;
  on<Event extends EventType>(event: Event, listener: Events[Event]): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this;
  once<Event extends EventType>(event: Event, listener: Events[Event]): this;
  once(event: string | symbol, listener: (...args: any[]) => void): this;
  prependListener<Event extends EventType>(
    event: Event,
    listener: Events[Event],
  ): this;
  prependListener(
    event: string | symbol,
    listener: (...args: any[]) => void,
  ): this;
  prependOnceListener<Event extends EventType>(
    event: Event,
    listener: Events[Event],
  ): this;
  prependOnceListener(
    event: string | symbol,
    listener: (...args: any[]) => void,
  ): this;
  removeListener<Event extends EventType>(
    event: Event,
    listener: Events[Event],
  ): this;
  removeListener(
    event: string | symbol,
    listener: (...args: any[]) => void,
  ): this;
}
