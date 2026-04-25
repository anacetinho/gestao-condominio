import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

const COOKIE_NAME = "ac_session";

export interface Session {
  userId: string;
  email: string;
  nome: string;
}

/**
 * Devolve a sessão actual ou null. Em produção isto seria via Supabase Auth.
 * Em dev: usamos um cookie `ac_session` com o userId.
 */
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME);
  if (!sessionCookie) return null;

  const user = await prisma.user.findUnique({
    where: { id: sessionCookie.value },
  });
  if (!user) return null;

  return { userId: user.id, email: user.email, nome: user.nome };
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    throw new Error("Sessão necessária");
  }
  return session;
}

export async function setSession(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
