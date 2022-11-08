import { includes } from '@codecb/ts-utils/list';
import { hasProperty } from '@codecb/ts-utils/object';
import { ClientRequest, IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import {
  ErrorCallback,
  ProxyInterface,
  ResolvedProxyOptions,
} from '../types.js';
import { getWebAgent } from '../utils/getWebAgent.js';
import { getPort, hasEncryptedConnection } from '../utils/misc.js';
import { setupRequestOptions } from '../utils/setupRequestOptions.js';
import { xForwarded } from '../utils/xForwarded.js';
import { BaseWebHandling } from './BaseWebHandling.js';
import { WebOutgoing } from './WebOutgoing.js';

export class WebIncoming extends BaseWebHandling {
  protected readonly handlers = [
    this.handleContentLength,
    this.handleTimeout,
    this.handleXHeaders,
    this.handleStream,
  ] as const;

  constructor(
    private readonly req: IncomingMessage,
    private readonly res: ServerResponse,
    private readonly options: ResolvedProxyOptions,
    private readonly server: ProxyInterface,
    private readonly onError?: ErrorCallback,
  ) {
    super();
  }

  private createErrorHandler(proxyReq: ClientRequest, url: URL) {
    return (err: Error) => {
      if (
        this.req.socket.destroyed &&
        hasProperty(err, 'code') &&
        err.code === 'ECONNRESET'
      ) {
        this.server.emit('econnreset', err, this.req, this.res, url);
        proxyReq.destroy();
        return;
      }
      if (this.onError) this.onError(err, this.req, this.res, url);
      else this.server.emit('error', err, this.req, this.res, url);
    };
  }

  private handleContentLength(): boolean | void {
    if (
      includes(['DELETE', 'OPTIONS'], this.req.method) &&
      !this.req.headers['content-length']
    ) {
      this.req.headers['content-length'] = '0';
      delete this.req.headers['transfer-encoding'];
    }
  }

  private handleStream(): boolean | void {
    const { target, forward } = this.options;
    this.server.emit('start', this.req, this.res, target ?? forward!);
    if (forward) this.handleStreamForward(forward);
    if (target) this.handleStreamProxy(target);
    else {
      this.res.end();
      return true;
    }
  }

  private handleStreamForward(forwardUrl: URL) {
    const { buffer, followRedirects, ssl } = this.options;

    const forwardReq = getWebAgent(
      followRedirects,
      forwardUrl.protocol === 'https:',
    ).request(
      setupRequestOptions(ssl || {}, this.options, this.req, forwardUrl),
    );

    const forwardErrorHandler = this.createErrorHandler(forwardReq, forwardUrl);
    this.req.on('error', forwardErrorHandler);
    forwardReq.on('error', forwardErrorHandler);
    (buffer ?? this.req).pipe(forwardReq);
  }

  private handleStreamProxy(proxyUrl: URL) {
    const { buffer, followRedirects, proxyTimeout, selfHandleResponse, ssl } =
      this.options;

    const proxyReq = getWebAgent(
      followRedirects,
      proxyUrl.protocol === 'https',
    ).request(setupRequestOptions(ssl || {}, this.options, this.req, proxyUrl));

    if (proxyTimeout)
      proxyReq.setTimeout(proxyTimeout, () => proxyReq.destroy());

    const handleProxyError = this.createErrorHandler(proxyReq, proxyUrl);

    proxyReq
      .on('error', handleProxyError)
      .on('response', proxyRes => {
        this.server.emit('proxyRes', proxyRes, this.req, this.res);

        if (!this.res.headersSent && !selfHandleResponse)
          new WebOutgoing(
            this.req,
            this.res,
            proxyUrl,
            proxyRes,
            this.options,
          ).handle();

        if (!this.res.writableEnded) {
          proxyRes.on('end', () =>
            this.server.emit('end', this.req, this.res, proxyRes),
          );
          if (!selfHandleResponse) proxyRes.pipe(this.res);
        } else {
          this.server.emit('end', this.req, this.res, proxyRes);
        }
      })
      .on('socket', () => {
        // Enable developers to modify the proxyReq before headers are sent
        if (!proxyReq.getHeader('expect'))
          this.server.emit(
            'proxyReq',
            proxyReq,
            this.req,
            this.res,
            this.options,
          );
      });

    this.req
      .on('close', () => proxyReq.destroy())
      .on('error', handleProxyError);

    (buffer ?? this.req).pipe(proxyReq);
  }

  private handleTimeout(): boolean | void {
    const { timeout } = this.options;
    if (timeout) this.req.socket.setTimeout(timeout);
  }

  private handleXHeaders(): boolean | void {
    const { xForward } = this.options;
    if (!xForward) return;
    const { appendWith, overrideWith, setHeader } = xForwarded;
    const encrypted =
      // TODO: where is `isSpdy` from?
      (hasProperty(this.req, 'isSpdy') && !!this.req.isSpdy) ||
      hasEncryptedConnection(this.req);
    setHeader(this.req, 'for', appendWith(this.req.socket.remoteAddress));
    setHeader(this.req, 'port', appendWith(getPort(this.req)));
    setHeader(this.req, 'proto', appendWith(encrypted ? 'https' : 'http'));
    setHeader(this.req, 'host', overrideWith(this.req.headers.host || ''));
  }
}
