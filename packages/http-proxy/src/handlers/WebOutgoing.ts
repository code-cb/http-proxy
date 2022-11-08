import { Dict } from '@codecb/ts-utils/object';
import { IncomingMessage, ServerResponse } from 'node:http';
import { format, Url, URL } from 'node:url';
import { ResolvedProxyOptions } from '../types.js';
import { BaseWebHandling } from './BaseWebHandling.js';

const getRawHeaderKeyMap = (rawHeaders: string[]): Dict => {
  const rawHeaderKeyMap: Dict = {};
  for (let i = 0; i < rawHeaders.length; i += 2) {
    const key = rawHeaders[i]!;
    rawHeaderKeyMap[key.toLowerCase()] = key;
  }
  return rawHeaderKeyMap;
};

type CookieOverrideValue =
  | { shouldOverride: false; newValue?: never }
  | { shouldOverride: true; newValue: string | undefined | null };

const getCookieOverrideValue = (
  cookieOverride: Dict<string | undefined | null> | string,
  prevValue: string,
): CookieOverrideValue => {
  if (typeof cookieOverride === 'string')
    return { shouldOverride: true, newValue: cookieOverride };
  if (prevValue in cookieOverride)
    return { shouldOverride: true, newValue: cookieOverride[prevValue] };
  return { shouldOverride: false };
};

const rewriteCookiePropertyImpl = (
  header: string,
  cookieRewrite: Dict<string | undefined | null> | string,
  propertyName: string,
) =>
  header.replace(
    new RegExp(`(;\\s*${propertyName}=)([^;]+)`, 'i'),
    (match: string, prefix: string, prevValue: string) => {
      const { newValue, shouldOverride } = getCookieOverrideValue(
        cookieRewrite,
        prevValue,
      );
      return shouldOverride ? (newValue ? `${prefix}${newValue}` : '') : match;
    },
  );

const rewriteCookieProperty = (
  header: string | string[],
  cookieRewrite: Dict<string | undefined | null> | string,
  propertyName: string,
) =>
  Array.isArray(header)
    ? header.map(header =>
        rewriteCookiePropertyImpl(header, cookieRewrite, propertyName),
      )
    : rewriteCookiePropertyImpl(header, cookieRewrite, propertyName);

export class WebOutgoing extends BaseWebHandling {
  protected readonly handlers = [
    this.handleChunkHeaders,
    this.handleConnectionHeaders,
    this.handleRedirectHostRewrite,
    this.handleHeadersCopying,
    this.handleStatusCode,
  ] as const;

  constructor(
    private readonly req: IncomingMessage,
    private readonly res: ServerResponse,
    private readonly proxyUrl: Url,
    private readonly proxyRes: IncomingMessage,
    private readonly options: ResolvedProxyOptions,
  ) {
    super();
  }

  private handleChunkHeaders(): boolean | void {
    if (this.req.httpVersion === '1.0')
      delete this.proxyRes.headers['transfer-encoding'];
  }

  private handleConnectionHeaders(): boolean | void {
    if (this.req.httpVersion === '1.0')
      this.proxyRes.headers.connection = this.req.headers.connection || 'close';
    else if (this.req.httpVersion !== '2.0')
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
    this.proxyRes.headers.location = format(locationUrl);
  }

  private handleStatusCode(): boolean | void {
    this.res.statusCode = this.proxyRes.statusCode!;
    if (this.proxyRes.statusMessage)
      this.res.statusMessage = this.proxyRes.statusMessage;
  }
}
