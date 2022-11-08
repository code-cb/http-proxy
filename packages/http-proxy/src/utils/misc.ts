import { IncomingMessage } from 'node:http';
import { TLSSocket } from 'node:tls';

const getPortFromHost = (req: IncomingMessage) =>
  req.headers.host?.match(/:(\d+)/)?.[1];

export const getDefaultPort = (secure: boolean) => (secure ? '443' : '80');

export const getPort = (req: IncomingMessage): string =>
  getPortFromHost(req) || getDefaultPort(hasEncryptedConnection(req));

export const hasEncryptedConnection = (req: IncomingMessage): boolean =>
  !!(req.socket as TLSSocket).encrypted;

export const isSslProtocol = (protocol: string): boolean =>
  /^https|wss/.test(protocol);
