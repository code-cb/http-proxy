import { URL, parse } from 'node:url';
import { SanitizedOptions } from './options';

export const formatUrl = ({
  protocol,
  hostname,
  socketPath,
  path,
  pathname,
  port,
  search,
}: SanitizedOptions) => {
  if (!path.startsWith('/')) return path;
  const url = new URL('http://abc.com');
  url.hostname = hostname
};
