import {
  createServer as createHttpServer,
  RequestListener,
  Server,
} from 'node:http';
import { createServer as createHttpsServer, ServerOptions } from 'node:https';
import { Socket } from 'node:net';
import { WebProxy } from './web/index.js';
import { WsProxy } from './ws/index.js';

export interface ProxyServerOptions {
  ssl?: ServerOptions | undefined;
  web: WebProxy;
  ws?: WsProxy;
}

export const createProxyServer = ({
  ssl,
  web,
  ws,
}: ProxyServerOptions): Server => {
  const requestListener: RequestListener = (req, res) => web.handle(req, res);
  const server = ssl
    ? createHttpsServer(ssl, requestListener)
    : createHttpServer(requestListener);
  if (ws)
    server.on('upgrade', (req, socket, head) =>
      ws.handle(req, socket as Socket, head),
    );
  return server;
};
