import { Dict } from '@codecb/ts-utils/object';

export const getRawHeaderKeyMap = (rawHeaders: string[]): Dict => {
  const rawHeaderKeyMap: Dict = {};
  for (let i = 0; i < rawHeaders.length; i += 2) {
    const key = rawHeaders[i]!;
    rawHeaderKeyMap[key.toLowerCase()] = key;
  }
  return rawHeaderKeyMap;
};

type CookieOverrideValue =
  | { shouldOverride: false; newValue?: never }
  | { shouldOverride: true; newValue: string | undefined | null };

const getCookieOverrideValue = (
  cookieOverride: Dict<string | undefined | null> | string,
  prevValue: string,
): CookieOverrideValue => {
  if (typeof cookieOverride === 'string')
    return { shouldOverride: true, newValue: cookieOverride };
  if (prevValue in cookieOverride)
    return { shouldOverride: true, newValue: cookieOverride[prevValue] };
  return { shouldOverride: false };
};

const rewriteCookiePropertyImpl = (
  header: string,
  cookieRewrite: Dict<string | undefined | null> | string,
  propertyName: string,
) =>
  header.replace(
    new RegExp(`(;\\s*${propertyName}=)([^;]+)`, 'i'),
    (match: string, prefix: string, prevValue: string) => {
      const { newValue, shouldOverride } = getCookieOverrideValue(
        cookieRewrite,
        prevValue,
      );
      return shouldOverride ? (newValue ? `${prefix}${newValue}` : '') : match;
    },
  );

export const rewriteCookieProperty = (
  header: string | string[],
  cookieRewrite: Dict<string | undefined | null> | string,
  propertyName: string,
) =>
  Array.isArray(header)
    ? header.map(header =>
        rewriteCookiePropertyImpl(header, cookieRewrite, propertyName),
      )
    : rewriteCookiePropertyImpl(header, cookieRewrite, propertyName);
