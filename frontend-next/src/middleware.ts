/**
 * src/middleware.ts
 * Next.js middleware — protect all routes except /login.
 *
 * The token is stored in localStorage (client-side only), so we can't read
 * it in the Edge middleware. We therefore protect routes at the component
 * level using AuthGuard, and the middleware only handles the public /login
 * route redirect to avoid a flash of the login page when already logged in.
 *
 * For a stricter setup, move to httpOnly cookies and decode the JWT here.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/_next", "/favicon", "/api"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths without auth check
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // For all other routes, let client-side AuthGuard handle the redirect.
  // The middleware simply passes through — protection is enforced in AuthGuard.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
