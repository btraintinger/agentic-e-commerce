import { isIP } from "node:net";
import { TRPCError } from "@trpc/server";

const windowMs = 60_000;
const maxAttempts = 5;
const windows = new Map<string, { endsAt: number; attempts: number }>();
let nextSweepAt = 0;

export function clientRateLimitKey(headers: Headers, trustProxy: boolean): string {
  const ip = trustProxy ? headers.get("x-forwarded-for")?.trim() : undefined;
  return ip && isIP(ip) ? ip : "unidentified";
}

export function limitCartValidation(clientKey: string) {
  const now = Date.now();
  if (now >= nextSweepAt) {
    for (const [key, window] of windows) {
      if (window.endsAt <= now) windows.delete(key);
    }
    nextSweepAt = now + windowMs;
  }

  const window = windows.get(clientKey);
  if (!window || window.endsAt <= now) {
    windows.set(clientKey, { endsAt: now + windowMs, attempts: 1 });
  } else {
    if (window.attempts >= maxAttempts) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Maximum 5 cart validations per minute" });
    }
    window.attempts++;
  }
}
