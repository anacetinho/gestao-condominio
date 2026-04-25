import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/sign-in", "/accept-invite", "/api/sign-out", "/api/cron"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname === "/") {
    return NextResponse.next();
  }
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = req.cookies.get(SESSION_COOKIE_NAME);
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
