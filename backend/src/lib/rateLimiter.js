import redis from "./redis.js";

/**
 * checkRateLimit
 *
 * Uses Redis INCR + EXPIRE to enforce rate limits.
 * Key pattern: ratelimit:{action}:{userId}
 *
 * @param {string} userId
 * @param {string} action    - e.g. "resume_upload"
 * @param {number} limit     - max requests allowed in window
 * @param {number} windowSec - time window in seconds
 * @returns {{ allowed: boolean, remaining: number, resetIn: number }}
 */
export async function checkRateLimit(
  userId,
  action,
  limit = 5,
  windowSec = 3600,
) {
  const key = `ratelimit:${action}:${userId}`;

  try {
    const current = await redis.incr(key);

    // set expiry only on first request in this window
    if (current === 1) {
      await redis.expire(key, windowSec);
    }

    const ttl = await redis.ttl(key);

    if (current > limit) {
      return {
        allowed: false,
        remaining: 0,
        resetIn: ttl,
      };
    }

    return {
      allowed: true,
      remaining: limit - current,
      resetIn: ttl,
    };
  } catch (err) {
    // if Redis fails, allow the request — don't block users due to infra issues
    console.error("[rate_limiter] Redis error:", err.message);
    return { allowed: true, remaining: limit, resetIn: windowSec };
  }
}
