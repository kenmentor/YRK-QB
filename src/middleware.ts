import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Route guards: sending unauthenticated visitors to login keeps
// workspaces, reviewing and personal pages intentional.
// Signature verification stays in the API layer; here a present,
// non-expired token is enough to let the request through.
const PROTECTED = [/^\/workspaces(\/.*)?$/, /^\/profile$/, /^\/contributions$/, /^\/notifications$/, /^\/admin(\/.*)?$/, /^\/bank\/subject\/[^/]+\/contribute$/];

function tokenAlive(token: string | undefined): boolean {
  if (!token) return false;
  try {
    // Edge-safe base64url decode (Buffer doesn't exist in Edge runtime).
    const [, payload] = token.split(".");
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const { exp } = JSON.parse(json);
    return !exp || exp * 1000 > Date.now();
  } catch {
    return true; // opaque, let the API decide
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED.some((re) => re.test(pathname))) return NextResponse.next();
  if (tokenAlive(req.cookies.get("yrk_token")?.value)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/workspaces/:path*", "/profile", "/contributions", "/notifications", "/admin/:path*", "/bank/subject/:id/contribute"]
};
