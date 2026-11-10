import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Quick check before a page loads: no session cookie means go to the login page. The API still checks every call. */
export function proxy(req: NextRequest) {
  const signedIn = req.cookies.has('mn_refresh');
  const onLogin = req.nextUrl.pathname === '/login';
  if (!signedIn && !onLogin) return NextResponse.redirect(new URL('/login', req.url));
  if (signedIn && onLogin) return NextResponse.redirect(new URL('/', req.url));
  return NextResponse.next();
}

export const config = { matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'] };
