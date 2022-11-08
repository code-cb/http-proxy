import { OmitStrict } from '@codecb/ts-utils/object';
import EventEmitter from 'eventemitter3';
import { ClientRequest, IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import { URL } from 'node:url';
import { BaseProxyOptions } from '../base/index.js';

export interface WsProxyOptions extends BaseProxyOptions {}

export interface WsHandlingOptions
  extends OmitStrict<WsProxyOptions, 'target'> {
  target: URL;
}

export type CloseCallback = (
  proxyRes: IncomingMessage,
  proxySocket: Socket,
  proxyHead: Buffer,
) => void;

export type OpenCallback = (proxySocket: Socket) => void;

export type WsErrorCallback = (
  err: Error,
  req: IncomingMessage,
  socket: Socket,
  targetUrl?: URL,
) => void;

export type WsProxyReqCallback = (
  proxyReq: ClientRequest,
  req: IncomingMessage,
  socket: Socket,
  options: WsHandlingOptions,
  head: Buffer,
) => void;

export interface WsProxyEventTypes {
  close: CloseCallback;
  error: WsErrorCallback;
  open: OpenCallback;
  proxyReq: WsProxyReqCallback;
}

export interface WsProxyInterface extends EventEmitter<WsProxyEventTypes> {}
