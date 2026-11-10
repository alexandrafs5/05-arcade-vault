import { createBrowserClient } from "@supabase/ssr";

// Browser client. Call inside effects or event handlers, not at module level.
export function createClient() {
  // Literal property access: Next inlines NEXT_PUBLIC_* only when written this way.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. See .env.example.",
    );
  }

  return createBrowserClient(url, key);
}
