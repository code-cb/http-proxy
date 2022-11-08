import {
  http as redirectsHttp,
  https as redirectsHttps,
} from 'follow-redirects';
import nativeHttp, { ClientRequest, RequestOptions } from 'node:http';
import nativeHttps from 'node:https';

export interface WebAgent {
  request: (options: RequestOptions) => ClientRequest;
}

export const getWebAgent = (
  followRedirects: boolean | undefined,
  https: boolean,
): WebAgent =>
  followRedirects
    ? https
      ? (redirectsHttps as unknown as WebAgent)
      : (redirectsHttp as unknown as WebAgent)
    : https
    ? nativeHttps
    : nativeHttp;
