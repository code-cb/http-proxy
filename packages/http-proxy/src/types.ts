import { Dict, OmitStrict } from '@codecb/ts-utils/object';
import EventEmitter from 'eventemitter3';
import { ClientRequest, IncomingMessage, ServerResponse } from 'node:http';
import {
  RequestOptions as HttpsRequestOptions,
  ServerOptions as HttpsServerOptions,
} from 'node:https';
import { Socket } from 'node:net';
import { Stream } from 'node:stream';
import { Url } from 'node:url';

type CookieRewrite = false | string | Dict<string | undefined | null>;

export interface InputProxyOptions
  extends Pick<
    HttpsRequestOptions,
    'agent' | 'auth' | 'ca' | 'headers' | 'localAddress' | 'method'
  > {
  autoRewrite?: boolean | undefined;
  buffer?: Stream | undefined;
  changeOrigin?: boolean | undefined;
  cookieDomainRewrite?: CookieRewrite | undefined;
  cookiePathRewrite?: CookieRewrite | undefined;
  selfHandleResponse?: boolean | undefined;
  followRedirects?: boolean | undefined;
  forward?: string | undefined;
  hostRewrite?: string | undefined;
  ignorePath?: boolean | undefined;
  prependPath?: boolean | undefined;
  preserveHeaderKeyCase?: boolean | undefined;
  protocolRewrite?: string | undefined;
  proxyTimeout?: number | undefined;
  secure?: boolean | undefined;
  ssl?: HttpsServerOptions | undefined;
  target?: string | undefined;
  timeout?: number | undefined;
  toProxy?: boolean | undefined;
  ws?: boolean | undefined;
  xForward?: boolean | undefined;
}

export interface ResolvedProxyOptions
  extends OmitStrict<InputProxyOptions, 'forward' | 'target'> {
  forward: Url | undefined;
  target: Url | undefined;
}

export type CloseCallback = (
  proxyRes: IncomingMessage,
  proxySocket: Socket,
  proxyHead: Buffer,
) => void;

export type EconnResetCallback = (
  err: Error,
  req: IncomingMessage,
  res: ServerResponse,
  target: Url,
) => void;

export type EndCallback = (
  req: IncomingMessage,
  res: ServerResponse,
  proxyRes: IncomingMessage,
) => void;

export type ErrorCallback = (
  err: Error,
  req: IncomingMessage,
  resOrSocket: ServerResponse | Socket,
  target?: Url,
) => void;

export type OpenCallback = (proxySocket: Socket) => void;

export type ProxyReqCallback = (
  proxyReq: ClientRequest,
  req: IncomingMessage,
  res: ServerResponse,
  options: ResolvedProxyOptions,
) => void;

export type ProxyReqWsCallback = (
  proxyReq: ClientRequest,
  req: IncomingMessage,
  socket: Socket,
  options: ResolvedProxyOptions,
  head: Buffer,
) => void;

export type ProxyResCallback = (
  proxyRes: IncomingMessage,
  req: IncomingMessage,
  res: ServerResponse,
) => void;

export type StartCallback = (
  req: IncomingMessage,
  res: ServerResponse,
  target: Url,
) => void;

export interface ProxyEventTypes {
  close: CloseCallback;
  econnreset: EconnResetCallback;
  end: EndCallback;
  error: ErrorCallback;
  open: OpenCallback;
  proxyReq: ProxyReqCallback;
  proxyReqWs: ProxyReqWsCallback;
  proxyRes: ProxyResCallback;
  start: StartCallback;
}

export interface ProxyInterface extends EventEmitter<ProxyEventTypes> {}
