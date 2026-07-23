import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "hf_session";

export type Session = { memberId: number; houseId: number; slug: string };

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function createSession(s: Session) {
  const token = await new SignJWT(s)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("90d")
    .sign(secret());
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
  });
}

export async function getSession(): Promise<Session | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      memberId: payload.memberId as number,
      houseId: payload.houseId as number,
      slug: payload.slug as string,
    };
  } catch {
    return null;
  }
}

export function clearSession() {
  cookies().delete(COOKIE);
}
