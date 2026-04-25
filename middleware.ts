import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedPaths = ['/dashboard', '/menu', '/checkout', '/kitchen', '/reports'];
const adminOnlyPaths = ['/dashboard', '/menu', '/checkout', '/reports'];
const authPaths = ['/login'];

function getRoleFromToken(token: string): string | null {
  try {
    // Decode JWT payload (middle part) without verification (middleware can't use jsonwebtoken)
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload.role || null;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get('pos-auth-token')?.value;
  const { pathname } = request.nextUrl;

  // Redirect root to appropriate page
  if (pathname === '/') {
    if (token) {
      const role = getRoleFromToken(token);
      if (role === 'chef') {
        return NextResponse.redirect(new URL('/kitchen', request.url));
      }
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

  // Role-based access: chef can only access /kitchen
  if (token && isProtectedPath) {
    const role = getRoleFromToken(token);
    const isAdminOnly = adminOnlyPaths.some((path) => pathname.startsWith(path));

    if (role === 'chef' && isAdminOnly) {
      return NextResponse.redirect(new URL('/kitchen', request.url));
    }
  }

  // Redirect authenticated users away from auth pages
  if (authPaths.some((path) => pathname.startsWith(path)) && token) {
    const role = getRoleFromToken(token);
    if (role === 'chef') {
      return NextResponse.redirect(new URL('/kitchen', request.url));
    }
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/menu/:path*', '/checkout/:path*', '/kitchen/:path*', '/reports/:path*', '/login'],
};
