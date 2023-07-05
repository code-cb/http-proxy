import { OmitStrict } from '@codecb/ts-utils/object';
import { OutgoingHttpHeaders } from 'node:http';
import { RequestOptions } from 'node:https';

export interface RedirectableRequestOptions extends RequestOptions {
  maxBodyLength?: number | undefined;
  maxRedirects?: number | undefined;
  path: string;
  protocol: string;
}

export interface SanitizedOptions
  extends OmitStrict<
    RedirectableRequestOptions,
    'headers' | 'host' | 'maxBodyLength' | 'maxRedirects' | 'protocol'
  > {
  headers: OutgoingHttpHeaders;
  maxBodyLength: number;
  maxRedirects: number;
  pathname?: string | undefined;
  protocol: string;
  search?: string | undefined;
}

const parsePath = (path: string) => {
  const searchPos = path.indexOf('?');
  return searchPos < 0
    ? { pathname: path }
    : {
        pathname: path.substring(0, searchPos),
        search: path.substring(searchPos),
      };
};

export const sanitizeOptions = ({
  headers,
  host,
  hostname = host,
  maxBodyLength = 10 * 1024 * 1024,
  maxRedirects = 21,
  path,
  ...rest
}: RedirectableRequestOptions): SanitizedOptions => {
  const { pathname, search } = parsePath(path);

  /**
   * Since `http.request` treats `host` as an alias of `hostname`, but
   * the `url` module interprets `host` as `hostname` plus `port`,
   * eliminate the host property to avoid confusion
   */
  return {
    ...rest,
    headers: { ...headers },
    hostname,
    maxBodyLength,
    maxRedirects,
    path,
    pathname,
    search,
  };
};
