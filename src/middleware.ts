import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_PATHS = ["/login", "/register", "/api/auth"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Get JWT token (edge-compatible, no Prisma needed)
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });

  // Redirect unauthenticated users to login
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = token.role as string;

  // Block clients from staff routes
  if (role === "CLIENT" && pathname.startsWith("/staff")) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Block clients from admin routes
  if (role === "CLIENT" && pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Block non-admins from admin routes
  if (role !== "ADMIN" && pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/staff/dashboard", req.url));
  }

  // Redirect staff accessing root /dashboard to staff dashboard
  if (
    (role === "PREPARER" || role === "MANAGER" || role === "ADMIN") &&
    pathname === "/dashboard"
  ) {
    return NextResponse.redirect(new URL("/staff/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
