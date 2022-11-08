import { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { BaseHandling } from '../base/index.js';
import { WebHandlingOptions } from './types.js';
import { getRawHeaderKeyMap, rewriteCookieProperty } from './utils.js';

export class WebOutgoing extends BaseHandling {
  protected override readonly handlers = [
    this.handleChunkHeaders,
    this.handleConnectionHeaders,
    this.handleRedirectHostRewrite,
    this.handleHeadersCopying,
    this.handleStatusCode,
  ] as const;

  constructor(
    private readonly req: IncomingMessage,
    private readonly res: ServerResponse,
    private readonly proxyUrl: URL,
    private readonly proxyRes: IncomingMessage,
    private readonly options: WebHandlingOptions,
  ) {
    super();
  }

  private handleChunkHeaders(): boolean | void {
    const { httpVersion } = this.req;
    if (httpVersion === '1.0')
      delete this.proxyRes.headers['transfer-encoding'];
  }

  private handleConnectionHeaders(): boolean | void {
    const { httpVersion } = this.req;
    if (httpVersion === '1.0')
      this.proxyRes.headers.connection = this.req.headers.connection || 'close';
    else if (httpVersion !== '2.0')
      this.proxyRes.headers.connection ||=
        this.req.headers.connection || 'keep-alive';
  }

  private handleHeadersCopying(): boolean | void {
    const { cookieDomainRewrite, cookiePathRewrite, preserveHeaderKeyCase } =
      this.options;
    const rawHeaderKeyMap =
      preserveHeaderKeyCase && getRawHeaderKeyMap(this.proxyRes.rawHeaders);
    Object.entries(this.proxyRes.headers).forEach(
      ([lowerCasedKey, currentValue]) => {
        const key =
          (rawHeaderKeyMap && rawHeaderKeyMap[lowerCasedKey]) || lowerCasedKey;
        if (currentValue === undefined) return;
        let newValue = currentValue;
        if (lowerCasedKey === 'set-cookie') {
          if (cookieDomainRewrite)
            newValue = rewriteCookieProperty(
              newValue,
              cookieDomainRewrite,
              'domain',
            );
          if (cookiePathRewrite)
            newValue = rewriteCookieProperty(
              newValue,
              cookiePathRewrite,
              'path',
            );
        }
        this.res.setHeader(key.trim(), newValue);
      },
    );
  }

  private handleRedirectHostRewrite(): boolean | void {
    const { autoRewrite, hostRewrite, protocolRewrite } = this.options;
    if (
      (!hostRewrite && !autoRewrite && !protocolRewrite) ||
      !this.proxyRes.headers.location ||
      ![201, 301, 302, 307, 308].includes(this.proxyRes.statusCode!)
    )
      return;

    const locationUrl = new URL(this.proxyRes.headers.location);
    if (this.proxyUrl.host !== locationUrl.host) return;
    if (hostRewrite) locationUrl.host = hostRewrite;
    else if (autoRewrite) locationUrl.host = this.req.headers.host!;
    if (protocolRewrite) locationUrl.protocol = protocolRewrite;
    this.proxyRes.headers.location = locationUrl.toString();
  }

  private handleStatusCode(): boolean | void {
    this.res.statusCode = this.proxyRes.statusCode!;
    if (this.proxyRes.statusMessage)
      this.res.statusMessage = this.proxyRes.statusMessage;
  }
}
