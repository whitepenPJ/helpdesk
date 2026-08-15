import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getHomePathForRole } from "@/app/lib/roles";

const PUBLIC_PATHS = ["/login"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  // Falls back to "/dashboard" when logged out — that target is only ever
  // used below for an unauthenticated "/" visit, which the next request
  // bounces to /login anyway, same as before this role-awareness existed.
  const homePath = req.auth?.user ? getHomePathForRole(req.auth.user.role) : "/dashboard";

  // There's no page at "/" (this app only has route groups under /login and
  // /dashboard) — send root visits straight to the signed-in user's home
  // rather than 404ing or round-tripping "/" through the login callbackUrl.
  if (pathname === "/") {
    return NextResponse.redirect(new URL(homePath, req.nextUrl));
  }

  if (!isLoggedIn && !isPublicPath) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isPublicPath) {
    return NextResponse.redirect(new URL(homePath, req.nextUrl));
  }
});

// Static files (icons, images, fonts served straight from public/ or the
// generated icon/favicon routes) must stay reachable without a session —
// browsers and Next's own image optimizer fetch them with no auth context.
// Matching by extension avoids re-discovering this one file at a time (see
// the icon.png incident this same pattern already fixed once).
export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|adminlte/|favicon.ico|icon.png|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|css|js|woff2?)$).*)",
  ],
};
