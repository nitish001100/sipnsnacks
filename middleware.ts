import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedPaths = ['/dashboard', '/menu', '/checkout', '/kitchen', '/reports'];
const authPaths = ['/login'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('pos-auth-token')?.value;
  const { pathname } = request.nextUrl;

  // Redirect root to dashboard or login
  if (pathname === '/') {
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Protect dashboard routes
  const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path));
  if (isProtectedPath && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth pages
  if (authPaths.some((path) => pathname.startsWith(path)) && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/menu/:path*', '/checkout/:path*', '/kitchen/:path*', '/reports/:path*', '/login'],
};
