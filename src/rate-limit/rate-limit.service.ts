import { Injectable, Logger } from '@nestjs/common';

export interface RateLimitOptions {
    /** Maximum number of requests allowed within the window */
    maxRequests: number;
    /** Window duration in milliseconds */
    windowMs: number;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfterMs: number;
}

/**
 * In-memory sliding-window rate limiting service.
 *
 * Limitation: this service is local to the Node process. For a multi-instance
 * deployment, the Map would need to be replaced by a shared store (e.g. Redis).
 * Sufficient for the scope of this project.
 */
@Injectable()
export class RateLimitService {
    private readonly logger = new Logger(RateLimitService.name);
    private readonly hits = new Map<string, number[]>();

    /**
     * Checks whether a request is allowed for a given client.
     * Records the request if it is.
     */
    check(clientId: string, options: RateLimitOptions): RateLimitResult {
        const now = Date.now();
        const windowStart = now - options.windowMs;

        // Retrieve and clean up timestamps within the window
        const timestamps = (this.hits.get(clientId) ?? []).filter(
            (ts) => ts > windowStart,
        );

        if (timestamps.length >= options.maxRequests) {
            // Calculate how long until the oldest request leaves the window
            const oldestInWindow = timestamps[0];
            const retryAfterMs = oldestInWindow + options.windowMs - now;
            this.hits.set(clientId, timestamps);
            return {
                allowed: false,
                remaining: 0,
                retryAfterMs: Math.max(retryAfterMs, 0),
            };
        }

        timestamps.push(now);
        this.hits.set(clientId, timestamps);

        return {
            allowed: true,
            remaining: options.maxRequests - timestamps.length,
            retryAfterMs: 0,
        };
    }

    /** Resets all counters (useful for tests). */
    reset(): void {
        this.hits.clear();
    }

    /** For tests: exposes the store size. */
    size(): number {
        return this.hits.size;
    }
}