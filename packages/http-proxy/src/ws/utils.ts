import { IncomingHttpHeaders } from 'node:http';
import { Socket } from 'node:net';

const toKeyValueString = (headers: IncomingHttpHeaders) =>
  Object.entries(headers).flatMap(([key, value]) =>
    !Array.isArray(value) ? `${key}: ${value}` : value.map(v => `${key}: ${v}`),
  );

export const createRawHeader = (line: string, headers: IncomingHttpHeaders) =>
  `${[line, ...toKeyValueString(headers)].join('\r\n')}\r\n\r\n`;

export const setupSocket = (socket: Socket) => {
  socket.setTimeout(0);
  socket.setNoDelay(true);
  socket.setKeepAlive(true, 0);
};
