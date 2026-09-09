export function allowedOrigins(value: string, production: boolean): string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      const url = new URL(origin);
      if (
        !["https:", "http:"].includes(url.protocol) ||
        (production && url.protocol !== "https:") ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash
      )
        throw new Error(
          "CLIENT_ORIGIN ต้องเป็น origin ที่ถูกต้อง และใช้ HTTPS ใน production",
        );
      return url.origin;
    });
}
export function isOriginAllowed(
  origin: string | undefined,
  host: string | undefined,
  origins: string[],
  production: boolean,
) {
  if (!origin) return true; // Server clients/health checks do not have browser Origin headers.
  try {
    const url = new URL(origin);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      (production && url.protocol !== "https:")
    )
      return false;
    return origins.length ? origins.includes(url.origin) : url.host === host;
  } catch {
    return false;
  }
}
