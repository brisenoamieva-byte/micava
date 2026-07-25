/** Cookie set after a recovery email link is exchanged — must set password before /cava. */
export const PENDING_PASSWORD_COOKIE = "micava_pending_password";

export function pendingPasswordCookieOptions(secure: boolean) {
  return {
    path: "/",
    maxAge: 60 * 60, // 1 hour
    sameSite: "lax" as const,
    secure,
    httpOnly: false, // client clears it after updateUser
  };
}
