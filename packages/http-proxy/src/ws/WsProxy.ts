import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import { URL } from 'node:url';
import { BaseProxy } from '../base/index.js';
import {
  WsErrorCallback,
  WsHandlingOptions,
  WsProxyEventTypes,
  WsProxyInterface,
  WsProxyOptions,
} from './types.js';
import { WsIncoming } from './WsIncoming.js';

export class WsProxy
  extends BaseProxy<WsErrorCallback, WsProxyEventTypes>
  implements WsProxyInterface
{
  constructor(private readonly initialOptions: WsProxyOptions) {
    super();
  }

  handle(
    req: IncomingMessage,
    socket: Socket,
    head: Buffer,
    additionalOptions?: WsProxyOptions,
    onError?: WsErrorCallback,
  ) {
    const { target, ...rest } = {
      ...this.initialOptions,
      ...additionalOptions,
    };
    const targetUrl = target ? new URL(target) : undefined;
    if (!targetUrl) return this.emitMissingTarget(req, socket);
    const handlingOptions: WsHandlingOptions = { ...rest, target: targetUrl };
    return new WsIncoming(
      req,
      socket,
      handlingOptions,
      head,
      this,
      onError,
    ).handle();
  }
}
