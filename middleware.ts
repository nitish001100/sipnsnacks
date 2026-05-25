import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedPaths = ['/dashboard', '/menu/manage', '/checkout', '/kitchen', '/reports', '/orders'];
const adminOnlyPaths = ['/dashboard', '/menu/manage', '/checkout', '/reports', '/orders'];
const authPaths = ['/login'];

function getRoleFromToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload.role || null;
  } catch {
    return null;
  }
}

function isAdminSubdomain(request: NextRequest): boolean {
  const hostname = request.headers.get('host') || '';
  // Match admin.sipnsnacks.vercel.app, admin.sipnsnacks.com, admin.localhost, etc.
  return hostname.startsWith('admin.');
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get('pos-auth-token')?.value;
  const { pathname } = request.nextUrl;
  const isAdmin = isAdminSubdomain(request);

  // ─── MAIN DOMAIN (sipnsnacks.vercel.app) ───
  // Public visitors: redirect everything to /menu
  if (!isAdmin) {
    // Allow /menu page to load normally
    if (pathname === '/menu') {
      return NextResponse.next();
    }

    // Allow API routes (needed for menu data, orders, etc.)
    if (pathname.startsWith('/api/')) {
      return NextResponse.next();
    }

    // Allow static assets & Next.js internals
    if (
      pathname.startsWith('/_next/') ||
      pathname.startsWith('/favicon') ||
      pathname.startsWith('/logo') ||
      pathname.startsWith('/manifest') ||
      pathname.startsWith('/firebase') ||
      pathname.match(/\.(png|jpg|jpeg|svg|ico|js|css|json|webp|woff|woff2|ttf)$/)
    ) {
      return NextResponse.next();
    }

    // Everything else → redirect to /menu
    return NextResponse.redirect(new URL('/menu', request.url));
  }

  // ─── ADMIN SUBDOMAIN (admin.sipnsnacks.vercel.app) ───
  // Full admin panel with login protection

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
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image).*)',
  ],
};
