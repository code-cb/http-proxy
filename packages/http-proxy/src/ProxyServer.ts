import EventEmitter from 'eventemitter3';
import {
  createServer as createHttpServer,
  IncomingMessage,
  RequestListener,
  Server,
  ServerResponse,
} from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { Socket } from 'node:net';
import { URL } from 'node:url';
import { WebIncoming } from './handlers/WebIncoming.js';
import { WsIncoming } from './handlers/WsIncoming.js';
import {
  ErrorCallback,
  ProxyEventTypes,
  ProxyInterface,
  InputProxyOptions,
  ResolvedProxyOptions,
} from './types.js';

export class ProxyServer
  extends EventEmitter<ProxyEventTypes>
  implements ProxyInterface
{
  readonly #options: InputProxyOptions;
  #server: Server | null = null;

  constructor({ prependPath = true, ...rest }: InputProxyOptions = {}) {
    super();
    this.#options = { ...rest, prependPath };
    this.on('error', this.#onError, this);
  }

  close(onDone: (err: Error | undefined) => void) {
    this.#server?.close(err => {
      this.#server = null;
      onDone?.(err);
    });
  }

  listen(port: number, hostname?: string) {
    const requestListener: RequestListener = (req, res) => this.web(req, res);
    const { ssl, ws } = this.#options;
    this.#server = ssl
      ? createHttpsServer(ssl, requestListener)
      : createHttpServer(requestListener);
    if (ws)
      this.#server.on('upgrade', (req, socket, head) =>
        this.ws(req, socket as Socket, head),
      );
    this.#server.listen(port, hostname);
    return this;
  }

  web(
    req: IncomingMessage,
    res: ServerResponse,
    additionalOptions?: InputProxyOptions,
    onError?: ErrorCallback,
  ) {
    const resolvedOptions = this.#resolveOptions(req, res, additionalOptions);
    new WebIncoming(req, res, resolvedOptions, this, onError).handle();
  }

  ws(
    req: IncomingMessage,
    socket: Socket,
    head: Buffer,
    additionalOptions?: InputProxyOptions,
    onError?: ErrorCallback,
  ) {
    const resolvedOptions = this.#resolveOptions(
      req,
      socket,
      additionalOptions,
    );
    return new WsIncoming(
      req,
      socket,
      resolvedOptions,
      head,
      this,
      onError,
    ).handle();
  }

  #onError(err: Error) {
    // NOTE: replicate Node code behavior using eventemitter3 so we force people to handle their own errors
    if (this.listeners('error').length === 1) throw err;
  }

  #resolveOptions(
    req: IncomingMessage,
    resOrSocket: ServerResponse | Socket,
    additionalOptions: InputProxyOptions | undefined,
  ) {
    const { forward, target, ...rest } = {
      ...this.#options,
      ...additionalOptions,
    };
    const parsedForward = forward ? new URL(forward) : undefined;
    const parsedTarget = target ? new URL(target) : undefined;
    if (!parsedTarget)
      this.emit(
        'error',
        new Error('Must provide a proper URL as target'),
        req,
        resOrSocket,
      );

    const resolvedOptions: ResolvedProxyOptions = {
      ...rest,
      forward: parsedForward,
      target: parsedTarget,
    };
    return resolvedOptions;
  }
}
