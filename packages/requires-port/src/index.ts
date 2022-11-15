/**
 * Check if we are required to add a port number
 * @see https://url.spec.whatwg.org/#default-port
 * @param port Port number we need to check
 * @param protocolOrUrl Protocol or url we need to check against
 * @returns Whether it is a default port for the given protocol
 */
export const requiresPort = (
  port: string | number,
  protocolOrUrl: string,
): boolean => {
  const protocol = protocolOrUrl.split(':')[0]!;
  const portNumber = +port;

  if (!portNumber) return false;

  switch (protocol) {
    case 'http':
    case 'ws':
      return portNumber !== 80;

    case 'https':
    case 'wss':
      return portNumber !== 443;

    case 'ftp':
      return portNumber !== 21;

    case 'gopher':
      return portNumber !== 70;

    case 'file':
      return false;

    default:
      return port !== 0;
  }
};

export default requiresPort;
