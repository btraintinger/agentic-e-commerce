import { isIP, SocketAddress } from "node:net";
import { TRPCError } from "@trpc/server";

const windowMs = 60_000;
const maxRequests = 5;
const windows = new Map<string, { count: number; expiresAt: number }>();
let nextCleanupAt = 0;

function clientIp(headers: Headers) {
  const forwarded =
    process.env.VERCEL === "1" ? headers.get("x-vercel-forwarded-for") : null;
  if (forwarded) {
    const version = isIP(forwarded);
    if (version === 4) return forwarded;
    if (version === 6) {
      return new SocketAddress({ address: forwarded, family: "ipv6" }).address;
    }
  }
  return "127.0.0.1";
}

export function enforceCartRateLimit(headers: Headers) {
  const now = performance.now();
  if (now >= nextCleanupAt) {
    for (const [ip, window] of windows) {
      if (window.expiresAt <= now) windows.delete(ip);
    }
    nextCleanupAt = now + windowMs;
  }

  const ip = clientIp(headers);
  const window = windows.get(ip);
  if (!window || window.expiresAt <= now) {
    windows.set(ip, { count: 1, expiresAt: now + windowMs });
    return;
  }

  if (window.count >= maxRequests) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Maximum 5 cart validations per minute",
    });
  }
  window.count++;
}
