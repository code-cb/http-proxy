import EventEmitter from '@codecb/event-emitter';
import { RequestOptions, ServerOptions } from 'node:https';

export type BaseErrorCallback = (err: Error, ...args: any) => void;

export type BaseProxyEventEmitter = EventEmitter<{ error: BaseErrorCallback }>;

export type WebHandler = () => boolean | void;

export interface ProxyRequestOptions
  extends Pick<
    RequestOptions,
    'agent' | 'auth' | 'ca' | 'headers' | 'localAddress' | 'method'
  > {
  changeOrigin?: boolean | undefined;
  ignorePath?: boolean | undefined;
  prependPath?: boolean | undefined;
  secure?: boolean | undefined;
  toProxy?: boolean | undefined;
}

export interface BaseProxyOptions extends ProxyRequestOptions {
  ssl?: ServerOptions | undefined;
  target?: string | undefined;
  xForward?: boolean | undefined;
}
