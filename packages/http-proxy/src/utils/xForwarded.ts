import { IncomingMessage } from 'node:http';

type CreateHeaderValue = (existingValue: string | undefined) => string;

export const xForwarded = {
  setHeader: (
    req: IncomingMessage,
    name: string,
    value: string | CreateHeaderValue,
  ) => {
    const xForwardedHeaderName = `x-forwarded-${name}`;
    req.headers[xForwardedHeaderName] =
      typeof value === 'string'
        ? value
        : value(req.headers[xForwardedHeaderName] as string | undefined);
  },

  appendWith:
    (value: string | undefined): CreateHeaderValue =>
    existingValue =>
      [existingValue, value].filter(Boolean).join(','),

  overrideWith:
    (value: string): CreateHeaderValue =>
    existingValue =>
      existingValue || value,
};
