import "server-only";
import { cookies } from "next/headers";

const FLASH_COOKIE = "rrb_user_created";

export function setUserCreatedFlash(email: string, password: string) {
  cookies().set(FLASH_COOKIE, JSON.stringify({ email, password }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/usuarios",
    maxAge: 30,
  });
}

export function readUserCreatedFlash(): { email: string; password: string } | null {
  const raw = cookies().get(FLASH_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.email === "string" && typeof parsed?.password === "string") {
      return parsed;
    }
  } catch {}
  return null;
}

export async function clearUserCreatedFlashAction() {
  "use server";
  cookies().set(FLASH_COOKIE, "", { path: "/usuarios", maxAge: 0 });
}
