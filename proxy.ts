import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// SPEC 15: refreshes the Supabase session cookie on each request.
// It only syncs cookies: no redirects, no rewrites, no auth gating.
export async function proxy(request: NextRequest) {
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
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: [
    // Skip static files, image optimization and common asset extensions.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
