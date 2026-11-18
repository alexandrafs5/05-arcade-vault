import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

// SPEC 15: exchanges the `code` from email links and OAuth for a session,
// then redirects to `next` (same-origin paths only). A user without a profile
// (first OAuth login) goes to /acceso/usuario to choose a username.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  const fail = () => NextResponse.redirect(`${origin}/acceso?error=callback`);

  if (!code) return fail();

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    const target = new URL("/acceso/usuario", origin);
    if (next !== "/") target.searchParams.set("next", next);
    return NextResponse.redirect(target);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
