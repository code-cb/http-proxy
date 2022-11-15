import { requiresPort } from '@codecb/requires-port';
import { IncomingMessage, OutgoingHttpHeaders } from 'node:http';
import { RequestOptions, ServerOptions } from 'node:https';
import { parse, URL } from 'node:url';
import { ProxyRequestOptions } from '../base/index.js';
import { getDefaultPort, isSslProtocol } from './misc.js';

const hasPort = (host: string) => host.indexOf(':') >= 0;

const setupHeaders = (
  options: ProxyRequestOptions,
  req: IncomingMessage,
  { host, port, protocol }: { host: string; port: string; protocol: string },
) => {
  const headers: OutgoingHttpHeaders = {
    ...req.headers,
    ...options.headers,
  };

  // NOTE: If we are false and not upgrading, set the `connection: close`. This is the right thing to do as Node core doesn't handle this COMPLETELY properly yet.
  if (!options.agent) {
    const connection = headers['connection'];
    if (
      typeof connection !== 'string' ||
      !/(^|,)\s*upgrade\s*($|,)/i.test(connection)
    )
      headers['connection'] = 'close';
  }

  if (options.changeOrigin)
    headers['host'] =
      requiresPort(port, protocol!) && !hasPort(host) ? `` : host;

  return headers;
};

const setupPath = (
  options: ProxyRequestOptions,
  req: IncomingMessage,
  target: URL,
) => {
  const targetPath = (options.prependPath !== false && target.pathname) || '';
  const outgoingPath = options.ignorePath
    ? ''
    : options.toProxy
    ? req.url!
    : parse(req.url!).path || '';
  return new URL(outgoingPath, targetPath).href;
};

export const setupRequestOptions = (
  base: Partial<ServerOptions>,
  options: ProxyRequestOptions,
  req: IncomingMessage,
  target: URL,
): RequestOptions => {
  const protocol = target.protocol!;
  const isSsl = isSslProtocol(protocol);
  const host = target.host!;
  const port = target.port || getDefaultPort(isSsl);

  return {
    ...base,
    agent: options.agent || false,
    ...(options.auth ? { auth: options.auth } : {}),
    ...(options.ca ? { ca: options.ca } : {}),
    headers: setupHeaders(options, req, { host, port, protocol }),
    host,
    hostname: target.hostname,
    localAddress: options.localAddress,
    method: options.method || req.method,
    path: setupPath(options, req, target),
    port,
    ...(isSsl ? { rejectUnauthorized: options.secure ?? true } : {}),
  };
};
