import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import { BaseHandling } from '../base/index.js';
import {
  getPort,
  getWebAgent,
  hasEncryptedConnection,
  isSslProtocol,
  setupRequestOptions,
  xForwarded,
} from '../utils/index.js';
import {
  WsErrorCallback,
  WsHandlingOptions,
  WsProxyInterface,
} from './types.js';
import { createRawHeader, setupSocket } from './utils.js';

export class WsIncoming extends BaseHandling {
  protected override readonly handlers = [
    this.handleWsChecking,
    this.handleXHeaders,
    this.handleStream,
  ] as const;

  constructor(
    private readonly req: IncomingMessage,
    private readonly socket: Socket,
    private readonly options: WsHandlingOptions,
    private readonly head: Buffer,
    private readonly proxy: WsProxyInterface,
    private readonly onError?: WsErrorCallback,
  ) {
    super();
  }

  private handleStream(): boolean | void {
    const { ssl, target } = this.options;
    setupSocket(this.socket);

    if (this.head.length) this.socket.unshift(this.head);

    const agent = getWebAgent(false, isSslProtocol(target.protocol));
    const proxyReq = agent
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
        this.socket
          .on('end', () => proxySocket.end())
          .write(
            createRawHeader(
              `HTTP/1.1 101 Switching Protocols`,
              proxyRes.headers,
            ),
          );
        setupSocket(proxySocket);
        if (proxyHead.length) proxySocket.unshift(proxyHead);
        proxySocket
          .on('end', () =>
            this.proxy.emit('close', proxyRes, proxySocket, proxyHead),
          )
          .on('error', err => this.onOutGoingError(err))
          .pipe(this.socket)
          .pipe(proxySocket);
        this.proxy.emit('open', proxySocket);
      })
      .end();

    this.proxy.emit(
      'proxyReq',
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
    else this.proxy.emit('error', err, this.req, this.socket);
    this.socket.end();
  }
}
