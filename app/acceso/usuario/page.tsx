import type { Metadata } from "next";
import { Suspense } from "react";
import { UsernameForm } from "@/components/username-form";

export const metadata: Metadata = { title: "Elige tu usuario · Arcade Vault" };

export default function UsuarioPage() {
  // UsernameForm reads ?next (request-time): needs Suspense.
  return (
    <Suspense>
      <UsernameForm />
    </Suspense>
  );
}
