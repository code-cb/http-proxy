import { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { BaseProxy } from '../base/index.js';
import {
  WebErrorCallback,
  WebHandlingOptions,
  WebProxyEventTypes,
  WebProxyInterface,
  WebProxyOptions,
} from './types.js';
import { WebIncoming } from './WebIncoming.js';

export class WebProxy
  extends BaseProxy<WebErrorCallback, WebProxyEventTypes>
  implements WebProxyInterface
{
  constructor(private readonly initialOptions: WebProxyOptions) {
    super();
  }

  handle(
    req: IncomingMessage,
    res: ServerResponse,
    additionalOptions?: WebProxyOptions,
    onError?: WebErrorCallback,
  ) {
    const { forward, target, ...rest } = {
      ...this.initialOptions,
      ...additionalOptions,
    };
    const forwardUrl = forward ? new URL(forward) : undefined;
    const targetUrl = target ? new URL(target) : undefined;
    if (!forwardUrl && !targetUrl) return this.emitMissingTarget(req, res);
    const handlingOptions: WebHandlingOptions = {
      ...rest,
      forward: forwardUrl,
      target: targetUrl,
    };
    return new WebIncoming(req, res, handlingOptions, this, onError).handle();
  }
}
