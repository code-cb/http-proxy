import { ProxyServer } from './ProxyServer.js';
import { InputProxyOptions } from './types.js';

export { ProxyServer } from './ProxyServer.js';
export { type InputProxyOptions as InputProxyServerOptions } from './types.js';

export const createProxyServer = (options: InputProxyOptions) =>
  new ProxyServer(options);
