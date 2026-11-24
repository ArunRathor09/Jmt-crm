import { NextResponse, type NextRequest } from "next/server";
const SESSION_COOKIE = "jmt_session";

const protectedPrefixes = [
  "/dashboard",
  "/leads",
  "/followups",
  "/customers",
  "/packages",
  "/tasks",
  "/reports",
  "/notifications",
  "/settings",
  "/users",
  "/audit-logs",
  "/change-password",
  "/2fa",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!isProtected) return NextResponse.next();

  if (!request.cookies.get(SESSION_COOKIE)?.value) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/leads/:path*", "/followups/:path*", "/customers/:path*", "/packages/:path*", "/tasks/:path*", "/reports/:path*", "/notifications/:path*", "/settings/:path*", "/users/:path*", "/audit-logs/:path*", "/change-password/:path*", "/2fa/:path*"],
};
