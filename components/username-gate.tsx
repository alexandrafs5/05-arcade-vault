"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/session";

// SPEC 15: a logged-in user without a profile (first OAuth login) cannot use
// the site until a username is saved. Auth routes are exempt.
export function UsernameGate() {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status !== "needs-username") return;
    if (pathname.startsWith("/acceso") || pathname.startsWith("/auth")) return;
    router.replace(`/acceso/usuario?next=${encodeURIComponent(pathname)}`);
  }, [status, pathname, router]);

  return null;
}
