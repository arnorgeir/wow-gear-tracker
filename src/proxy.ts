import { NextResponse, type NextRequest } from 'next/server';
import { BODY_LIMIT, BODY_TOO_LARGE, bodyExceeds, checkRequest, isApiWrite, type GuardFailure } from '@/server/request-guard';

const reject = ({ error, status }: GuardFailure) => NextResponse.json({ error }, { status });

// Runs before every page and route. The rules live in request-guard.ts.
export async function proxy(request: NextRequest) {
  const { method } = request;
  const { pathname } = request.nextUrl;
  const failure = checkRequest({
    method,
    pathname,
    host: request.headers.get('host'),
    origin: request.headers.get('origin'),
    secFetchSite: request.headers.get('sec-fetch-site'),
    contentLength: request.headers.get('content-length'),
  });
  if (failure) return reject(failure);
  // Content-Length is absent on chunked bodies, so measure the body itself.
  if (isApiWrite(method, pathname) && (await bodyExceeds(request.body, BODY_LIMIT))) return reject(BODY_TOO_LARGE);
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png).*)'],
};
