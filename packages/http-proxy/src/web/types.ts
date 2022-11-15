import { EventEmitter } from '@codecb/event-emitter';
import { Dict, OmitStrict } from '@codecb/ts-utils/object';
import { ClientRequest, IncomingMessage, ServerResponse } from 'node:http';
import { Stream } from 'node:stream';
import { BaseProxyOptions } from '../base/index.js';

export type CookieRewrite = false | string | Dict<string | undefined | null>;

export interface WebProxyOptions extends BaseProxyOptions {
  autoRewrite?: boolean | undefined;
  buffer?: Stream | undefined;
  cookieDomainRewrite?: CookieRewrite | undefined;
  cookiePathRewrite?: CookieRewrite | undefined;
  followRedirects?: boolean | undefined;
  forward?: string | undefined;
  hostRewrite?: string | undefined;
  preserveHeaderKeyCase?: boolean | undefined;
  protocolRewrite?: string | undefined;
  proxyTimeout?: number | undefined;
  selfHandleResponse?: boolean | undefined;
  timeout?: number | undefined;
}

export interface WebHandlingOptions
  extends OmitStrict<WebProxyOptions, 'forward' | 'target'> {
  forward: URL | undefined;
  target: URL | undefined;
}

export type EconnResetCallback = (
  err: Error,
  req: IncomingMessage,
  res: ServerResponse,
  targetUrl: URL,
) => void;

export type EndCallback = (
  req: IncomingMessage,
  res: ServerResponse,
  proxyRes: IncomingMessage,
) => void;

export type ProxyResCallback = (
  proxyRes: IncomingMessage,
  req: IncomingMessage,
  res: ServerResponse,
) => void;

export type StartCallback = (
  req: IncomingMessage,
  res: ServerResponse,
  targetUrl: URL,
) => void;

export type WebErrorCallback = (
  err: Error,
  req: IncomingMessage,
  res: ServerResponse,
  targetUrl?: URL,
) => void;

export type WebProxyReqCallback = (
  proxyReq: ClientRequest,
  req: IncomingMessage,
  res: ServerResponse,
  options: WebHandlingOptions,
) => void;

export type WebProxyEventTypes = {
  econnreset: EconnResetCallback;
  end: EndCallback;
  error: WebErrorCallback;
  proxyReq: WebProxyReqCallback;
  proxyRes: ProxyResCallback;
  start: StartCallback;
};

export interface WebProxyInterface extends EventEmitter<WebProxyEventTypes> {}
