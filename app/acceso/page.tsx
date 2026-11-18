import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Acceso · Arcade Vault" };

export default function AccesoPage() {
  // AuthForm reads ?error and ?next (request-time): needs Suspense.
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
