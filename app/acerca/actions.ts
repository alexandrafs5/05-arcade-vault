"use server";

import { Resend } from "resend";

export type ContactState =
  | { status: "idle" }
  | { status: "sent"; name: string }
  | { status: "invalid" } // client shows shake
  | { status: "error" }; // Resend or config failure; client shows [ERROR] + retry

const MAX_NAME = 80;
const MAX_EMAIL = 254;
const MAX_MSG = 2000;

// Pragmatic format check; real validation is the delivery itself
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function sendContactMessage(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  // Honeypot: bots fill it. Pretend success, send nothing.
  if (field(formData, "website") !== "") {
    return { status: "sent", name: field(formData, "name").slice(0, MAX_NAME) };
  }

  const name = field(formData, "name");
  const email = field(formData, "email");
  const msg = field(formData, "msg");

  if (
    !name ||
    !email ||
    !msg ||
    name.length > MAX_NAME ||
    email.length > MAX_EMAIL ||
    msg.length > MAX_MSG ||
    !EMAIL_RE.test(email)
  ) {
    return { status: "invalid" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL;
  if (!apiKey || !to || !from) {
    return { status: "error" };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to,
      replyTo: email,
      // Collapse whitespace/newlines so the name cannot inject header content
      subject: `[Arcade Vault] Mensaje de ${name.replace(/\s+/g, " ")}`,
      text: `Nombre: ${name}\nEmail: ${email}\n\n${msg}`,
    });
    if (error) return { status: "error" };
    return { status: "sent", name };
  } catch {
    return { status: "error" };
  }
}
