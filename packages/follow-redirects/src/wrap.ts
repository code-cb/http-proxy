import { id } from '@codecb/ts-utils/common';
import { ClientRequest } from 'node:http';
import {
  IncomingMessage,
  request as httpRequest,
  RequestOptions as HttpRequestOptions,
} from 'node:http';
import {
  request as httpsRequest,
  RequestOptions as HttpsRequestOptions,
} from 'node:https';
import { SanitizedOptions } from './options';
import { RedirectableRequest } from './RedirectableRequest';

type ResponseCallback = (res: IncomingMessage) => void;

const parseUrl = ({ hostname, pathname, port, protocol, search }: URL) =>
  id<Partial<SanitizedOptions>>()({
    hostname,
    path: pathname + search,
    pathname: pathname,
    ...(port ? { port: Number(port) } : {}),
    protocol,
    search,
  });

const parseArgs = <RequestOptions extends HttpRequestOptions>(
  arg1: RequestOptions | string | URL,
  arg2: RequestOptions | ResponseCallback | undefined,
  arg3: ResponseCallback | undefined,
) => {
  let parsedUrl: Partial<SanitizedOptions> = {};
  let requestOptions: RequestOptions | undefined;

  if (typeof arg1 === 'string') parsedUrl = parseUrl(new URL(arg1));
  else if (arg1 instanceof URL) parsedUrl = parseUrl(arg1);
  else {
    parsedUrl;
  }
};

type NativeRequestFn<RequestOptions extends HttpRequestOptions> = (
  options: RequestOptions,
  callback: ResponseCallback | undefined,
) => ClientRequest;

const sendRequest = <RequestOptions extends HttpRequestOptions>(
  nativeRequestFn: NativeRequestFn<RequestOptions>,
  arg1: HttpRequestOptions | string | URL,
  arg2: HttpRequestOptions | ResponseCallback | undefined,
  arg3: ResponseCallback | undefined,
): RedirectableRequest => {};

const sendGet = <RequestOptions extends HttpRequestOptions>(
  nativeRequestFn: NativeRequestFn<RequestOptions>,
  arg1: HttpRequestOptions | string | URL,
  arg2: HttpRequestOptions | ResponseCallback | undefined,
  arg3: ResponseCallback | undefined,
): RedirectableRequest => {};

interface RequestModule<RequestOptions extends HttpRequestOptions> {
  request(
    options: RequestOptions | string | URL,
    callback?: ResponseCallback,
  ): RedirectableRequest;
  request(
    url: string | URL,
    options: RequestOptions,
    callback?: ResponseCallback,
  ): RedirectableRequest;

  get(
    options: RequestOptions | string | URL,
    callback?: ResponseCallback,
  ): RedirectableRequest;
  get(
    url: string | URL,
    options: RequestOptions,
    callback?: ResponseCallback,
  ): RedirectableRequest;
}

export const http: RequestModule<HttpRequestOptions> = {
  get(
    arg1: HttpRequestOptions | string | URL,
    arg2?: HttpRequestOptions | ResponseCallback | undefined,
    arg3?: ResponseCallback | undefined,
  ): RedirectableRequest {
    return sendGet(httpRequest, arg1, arg2, arg3);
  },

  request(
    arg1: HttpRequestOptions | string | URL,
    arg2?: HttpRequestOptions | ResponseCallback | undefined,
    arg3?: ResponseCallback | undefined,
  ): RedirectableRequest {
    return sendRequest(httpRequest, arg1, arg2, arg3);
  },
};

export const https: RequestModule<HttpsRequestOptions> = {
  get(
    arg1: HttpsRequestOptions | string | URL,
    arg2?: HttpsRequestOptions | ResponseCallback | undefined,
    arg3?: ResponseCallback | undefined,
  ): RedirectableRequest {
    return sendGet(httpsRequest, arg1, arg2, arg3);
  },

  request(
    arg1: HttpsRequestOptions | string | URL,
    arg2?: HttpsRequestOptions | ResponseCallback | undefined,
    arg3?: ResponseCallback | undefined,
  ): RedirectableRequest {
    return sendRequest(httpsRequest, arg1, arg2, arg3);
  },
};
