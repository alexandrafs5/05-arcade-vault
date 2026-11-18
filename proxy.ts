import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// SPEC 15: refreshes the Supabase session cookie on each request.
// SPEC 16: adds route rules (probe 404s, auth page redirects). Authorization of
// data stays in RLS; this only keeps users and bots off pages that make no sense.
const GUEST_BLOCKED = ["/acceso/usuario", "/acceso/nueva-clave"]; // need a session
const USER_BLOCKED = ["/acceso", "/acceso/recuperar"]; // logged-in users leave
const PROBE = /^\/(\.env|\.git|wp-admin|wp-login\.php|xmlrpc\.php|phpmyadmin)/i;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Ignore a trailing slash when matching exact paths.
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  // Bots scanning for known files get a plain 404.
  if (PROBE.test(path)) return new NextResponse(null, { status: 404 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([k, v]) =>
          response.headers.set(k, v),
        );
      },
    },
  });

  // Validates the JWT and refreshes the session when it is about to expire.
  const { data } = await supabase.auth.getClaims();
  const hasSession = !!data?.claims;

  const redirectTo = hasSession
    ? USER_BLOCKED.includes(path)
      ? "/"
      : null
    : GUEST_BLOCKED.includes(path)
      ? "/acceso"
      : null;

  if (redirectTo) {
    const target = request.nextUrl.clone();
    target.pathname = redirectTo;
    const redirect = NextResponse.redirect(target);
    // Copy refreshed session cookies and headers so a redirect never drops a token.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    response.headers.forEach((value, name) => {
      if (name.toLowerCase() === "cache-control")
        redirect.headers.set(name, value);
    });
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    // Skip static files, image optimization and common asset extensions.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
