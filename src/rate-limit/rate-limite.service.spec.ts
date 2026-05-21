import { RateLimitService } from './rate-limit.service';

describe('RateLimitService', () => {
    let service: RateLimitService;

    beforeEach(() => {
        service = new RateLimitService();
    });

    it('allows requests below the threshold', () => {
        const opts = { maxRequests: 3, windowMs: 1000 };
        expect(service.check('user:1', opts).allowed).toBe(true);
        expect(service.check('user:1', opts).allowed).toBe(true);
        expect(service.check('user:1', opts).allowed).toBe(true);
    });

    it('rejects requests beyond the threshold', () => {
        const opts = { maxRequests: 2, windowMs: 1000 };
        service.check('user:1', opts);
        service.check('user:1', opts);
        const result = service.check('user:1', opts);
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('isolates counters per clientId', () => {
        const opts = { maxRequests: 1, windowMs: 1000 };
        expect(service.check('user:1', opts).allowed).toBe(true);
        expect(service.check('user:2', opts).allowed).toBe(true);
        expect(service.check('user:1', opts).allowed).toBe(false);
    });

    it('releases slots after the window expires (sliding window)', async () => {
        const opts = { maxRequests: 1, windowMs: 50 };
        expect(service.check('user:1', opts).allowed).toBe(true);
        expect(service.check('user:1', opts).allowed).toBe(false);

        await new Promise((r) => setTimeout(r, 60));

        expect(service.check('user:1', opts).allowed).toBe(true);
    });

    it('exposes remaining correctly', () => {
        const opts = { maxRequests: 3, windowMs: 1000 };
        expect(service.check('user:1', opts).remaining).toBe(2);
        expect(service.check('user:1', opts).remaining).toBe(1);
        expect(service.check('user:1', opts).remaining).toBe(0);
    });

    it('reset clears the store', () => {
        service.check('user:1', { maxRequests: 1, windowMs: 1000 });
        expect(service.size()).toBe(1);
        service.reset();
        expect(service.size()).toBe(0);
    });
});