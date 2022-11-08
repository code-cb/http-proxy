import { includes } from '@codecb/ts-utils/list';
import { hasProperty } from '@codecb/ts-utils/object';
import { ClientRequest, IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { BaseHandling } from '../base/index.js';
import { getWebAgent } from '../utils/getWebAgent.js';
import {
  getPort,
  hasEncryptedConnection,
  isSslProtocol,
  setupRequestOptions,
  xForwarded,
} from '../utils/index.js';
import {
  WebErrorCallback,
  WebHandlingOptions,
  WebProxyInterface,
} from './types.js';
import { WebOutgoing } from './WebOutgoing.js';

export class WebIncoming extends BaseHandling {
  protected override readonly handlers = [
    this.handleContentLength,
    this.handleTimeout,
    this.handleXHeaders,
    this.handleStream,
  ] as const;

  constructor(
    private readonly req: IncomingMessage,
    private readonly res: ServerResponse,
    private readonly options: WebHandlingOptions,
    private readonly proxy: WebProxyInterface,
    private readonly onError?: WebErrorCallback,
  ) {
    super();
  }

  private createErrorHandler(clientRequest: ClientRequest, targetUrl: URL) {
    return (err: Error) => {
      if (
        this.req.socket.destroyed &&
        hasProperty(err, 'code') &&
        err.code === 'ECONNRESET'
      ) {
        this.proxy.emit('econnreset', err, this.req, this.res, targetUrl);
        clientRequest.destroy();
        return;
      }

      if (this.onError) this.onError(err, this.req, this.res, targetUrl);
      else this.proxy.emit('error', err, this.req, this.res, targetUrl);
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
    const { forward, target } = this.options;
    this.proxy.emit('start', this.req, this.res, (target ?? forward)!);
    if (forward) this.handleStreamForward(forward);
    if (target) this.handleStreamProxy(target);
    else {
      this.res.end();
      return true;
    }
  }

  private handleStreamForward(forwardUrl: URL) {
    const { buffer, followRedirects, ssl } = this.options;
    const agent = getWebAgent(
      followRedirects,
      isSslProtocol(forwardUrl.protocol),
    );
    const forwardReq = agent.request(
      setupRequestOptions(ssl ?? {}, this.options, this.req, forwardUrl),
    );
    const handleError = this.createErrorHandler(forwardReq, forwardUrl);
    this.req.on('error', handleError);
    forwardReq.on('error', handleError);
    (buffer ?? this.req).pipe(forwardReq);
  }

  private handleStreamProxy(proxyUrl: URL) {
    const { buffer, followRedirects, proxyTimeout, selfHandleResponse, ssl } =
      this.options;
    const agent = getWebAgent(
      followRedirects,
      isSslProtocol(proxyUrl.protocol),
    );
    const proxyReq = agent.request(
      setupRequestOptions(ssl ?? {}, this.options, this.req, proxyUrl),
    );
    const handleError = this.createErrorHandler(proxyReq, proxyUrl);

    if (proxyTimeout)
      proxyReq.setTimeout(proxyTimeout, () => proxyReq.destroy());

    proxyReq
      .on('error', handleError)
      .on('response', proxyRes => {
        this.proxy.emit('proxyRes', proxyRes, this.req, this.res);

        if (!this.res.headersSent && !selfHandleResponse)
          new WebOutgoing(
            this.req,
            this.res,
            proxyUrl,
            proxyRes,
            this.options,
          ).handle();

        if (this.res.writableEnded) {
          this.proxy.emit('end', this.req, this.res, proxyRes);
          return;
        }

        proxyRes.on('end', () =>
          this.proxy.emit('end', this.req, this.res, proxyRes),
        );
        if (!selfHandleResponse) proxyRes.pipe(this.res);
      })
      .on('socket', () => {
        if (!proxyReq.getHeader('expect'))
          this.proxy.emit(
            'proxyReq',
            proxyReq,
            this.req,
            this.res,
            this.options,
          );
      });

    this.req.on('close', () => proxyReq.destroy()).on('error', handleError);

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
      (hasProperty(this.req, 'isSpdy') && !!this.req.isSpdy) ||
      hasEncryptedConnection(this.req);
    setHeader(this.req, 'for', appendWith(this.req.socket.remoteAddress));
    setHeader(this.req, 'port', appendWith(getPort(this.req)));
    setHeader(this.req, 'proto', appendWith(encrypted ? 'https' : 'http'));
    setHeader(this.req, 'host', overrideWith(this.req.headers.host || ''));
  }
}
