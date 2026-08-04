export const REGISTRANT_COOKIE = "cc_registrant_token";
export const ADMIN_COOKIE = "ew_admin_session";

export const registrantCookieOptions = (maxAge = 3600) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

export const clearedCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 0,
};
