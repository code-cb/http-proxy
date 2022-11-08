import { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import {
  ErrorCallback,
  ProxyInterface,
  ResolvedProxyOptions,
} from '../types.js';
import { getWebAgent } from '../utils/getWebAgent.js';
import {
  getPort,
  hasEncryptedConnection,
  isSslProtocol,
} from '../utils/misc.js';
import { setupRequestOptions } from '../utils/setupRequestOptions.js';
import { xForwarded } from '../utils/xForwarded.js';
import { BaseWebHandling } from './BaseWebHandling.js';

const toKeyValueString = (headers: IncomingHttpHeaders) =>
  Object.entries(headers).flatMap(([key, value]) =>
    !Array.isArray(value) ? `${key}: ${value}` : value.map(v => `${key}: ${v}`),
  );

const createRawHeader = (line: string, headers: IncomingHttpHeaders) =>
  `${[line, ...toKeyValueString(headers)].join('\r\n')}\r\n\r\n`;

const setupSocket = (socket: Socket) => {
  socket.setTimeout(0);
  socket.setNoDelay(true);
  socket.setKeepAlive(true, 0);
};

export class WsIncoming extends BaseWebHandling {
  protected readonly handlers = [
    this.handleWsChecking,
    this.handleXHeaders,
    this.handleStream,
  ] as const;

  constructor(
    private readonly req: IncomingMessage,
    private readonly socket: Socket,
    private readonly options: ResolvedProxyOptions,
    private readonly head: Buffer,
    private readonly server: ProxyInterface,
    private readonly onError: ErrorCallback | undefined,
  ) {
    super();
  }

  private handleStream(): boolean | void {
    const { ssl, target } = this.options;

    if (!target) return true;

    setupSocket(this.socket);
    if (this.head.length) this.socket.unshift(this.head);

    const proxyReq = getWebAgent(false, isSslProtocol(target.protocol!))
      .request(setupRequestOptions(ssl ?? {}, this.options, this.req, target))
      .on('error', err => this.onOutGoingError(err))
      .on('response', res => {
        // TODO: where is `upgrade` from???
        if (!(res as any).upgrade) {
          const { headers, httpVersion, statusCode, statusMessage } = res;
          this.socket.write(
            createRawHeader(
              `HTTP/${httpVersion} ${statusCode} ${statusMessage}`,
              headers,
            ),
          );
          res.pipe(this.socket);
        }
      })
      .on('upgrade', (proxyRes, proxySocket, proxyHead) => {
        setupSocket(proxySocket);
        proxySocket
          .on('end', () =>
            this.server.emit('close', proxyRes, proxySocket, proxyHead),
          )
          .on('error', err => this.onOutGoingError(err));
        this.socket.on('end', () => proxySocket.end());
        if (proxyHead.length) proxySocket.unshift(proxyHead);
        this.socket.write(
          createRawHeader(`HTTP/1.1 101 Switching Protocols`, proxyRes.headers),
        );
        proxySocket.pipe(this.socket).pipe(proxySocket);
        this.server.emit('open', proxySocket);
      })
      .end();

    // Enable developers to modify the proxyReq before headers are sent
    this.server.emit(
      'proxyReqWs',
      proxyReq,
      this.req,
      this.socket,
      this.options,
      this.head,
    );
  }

  private handleWsChecking(): boolean | void {
    if (
      this.req.method !== 'GET' ||
      this.req.headers.upgrade?.toLowerCase() !== 'websocket'
    ) {
      this.socket.destroy();
      return true;
    }
  }

  private handleXHeaders(): boolean | void {
    const { xForward } = this.options;
    if (!xForward) return;
    const { appendWith, setHeader } = xForwarded;
    const encrypted = hasEncryptedConnection(this.req);
    setHeader(this.req, 'for', appendWith(this.req.socket.remoteAddress));
    setHeader(this.req, 'port', appendWith(getPort(this.req)));
    setHeader(this.req, 'proto', appendWith(encrypted ? 'wss' : 'ws'));
  }

  private onOutGoingError(err: Error) {
    if (this.onError) this.onError(err, this.req, this.socket);
    else this.server.emit('error', err, this.req, this.socket);
    this.socket.end();
  }
}
