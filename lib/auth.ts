import { createNeonAuth } from "@neondatabase/auth/next/server";
export const authConfigured = () =>
  Boolean(
    process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET,
  );
export function getAuth() {
  if (!authConfigured()) throw new Error("Neon Auth is niet ingesteld");
  return createNeonAuth({
    baseUrl: process.env.NEON_AUTH_BASE_URL!,
    cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
  });
}
