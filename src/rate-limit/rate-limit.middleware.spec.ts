import { HttpException, HttpStatus } from '@nestjs/common';
import { RateLimitMiddleware } from './rate-limit.middleware';
import { RateLimitService } from './rate-limit.service';

const makeService = (allowed: boolean, remaining = 50, retryAfterMs = 0) =>
    ({
        check: jest.fn().mockReturnValue({ allowed, remaining, retryAfterMs }),
    }) as unknown as RateLimitService;

const makeReq = (overrides: Record<string, any> = {}) =>
    ({
        ip: '127.0.0.1',
        headers: {},
        socket: {},
        ...overrides,
    }) as any;

const makeRes = () => {
    const headers: Record<string, any> = {};
    return {
        setHeader: jest.fn((key: string, val: any) => { headers[key] = val; }),
        _headers: headers,
    } as any;
};

describe('RateLimitMiddleware', () => {
    it('calls next() and sets rate-limit headers when request is allowed', () => {
        const svc = makeService(true, 99);
        const mw = new RateLimitMiddleware(svc);
        const req = makeReq();
        const res = makeRes();
        const next = jest.fn();

        mw.use(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 99);
    });

    it('throws 429 and sets Retry-After when rate limit is exceeded', () => {
        const svc = makeService(false, 0, 30_000);
        const mw = new RateLimitMiddleware(svc);
        const req = makeReq();
        const res = makeRes();
        const next = jest.fn();

        expect(() => mw.use(req, res, next)).toThrow(HttpException);
        expect(next).not.toHaveBeenCalled();
        expect(res.setHeader).toHaveBeenCalledWith('Retry-After', 30);
    });

    it('identifies client by userId when authenticated', () => {
        const svc = makeService(true);
        const mw = new RateLimitMiddleware(svc);
        const req = makeReq({ session: { user: { id: 'user-42' } } });
        const res = makeRes();

        mw.use(req, res, jest.fn());

        expect(svc.check).toHaveBeenCalledWith('user:user-42', expect.any(Object));
    });

    it('falls back to IP when not authenticated', () => {
        const svc = makeService(true);
        const mw = new RateLimitMiddleware(svc);
        const req = makeReq({ ip: '10.0.0.1' });
        const res = makeRes();

        mw.use(req, res, jest.fn());

        expect(svc.check).toHaveBeenCalledWith('ip:10.0.0.1', expect.any(Object));
    });

    it('uses x-forwarded-for when req.ip is absent', () => {
        const svc = makeService(true);
        const mw = new RateLimitMiddleware(svc);
        const req = makeReq({ ip: undefined, headers: { 'x-forwarded-for': '192.168.1.1' } });
        const res = makeRes();

        mw.use(req, res, jest.fn());

        expect(svc.check).toHaveBeenCalledWith('ip:192.168.1.1', expect.any(Object));
    });

    it('uses socket remoteAddress as last fallback', () => {
        const svc = makeService(true);
        const mw = new RateLimitMiddleware(svc);
        const req = makeReq({ ip: undefined, headers: {}, socket: { remoteAddress: '172.16.0.1' } });
        const res = makeRes();

        mw.use(req, res, jest.fn());

        expect(svc.check).toHaveBeenCalledWith('ip:172.16.0.1', expect.any(Object));
    });

    it('uses "unknown" when no IP can be resolved', () => {
        const svc = makeService(true);
        const mw = new RateLimitMiddleware(svc);
        const req = makeReq({ ip: undefined, headers: {}, socket: {} });
        const res = makeRes();

        mw.use(req, res, jest.fn());

        expect(svc.check).toHaveBeenCalledWith('ip:unknown', expect.any(Object));
    });

    it('throws 429 with correct payload structure', () => {
        const svc = makeService(false, 0, 5_000);
        const mw = new RateLimitMiddleware(svc);

        try {
            mw.use(makeReq(), makeRes(), jest.fn());
            fail('should have thrown');
        } catch (e: any) {
            expect(e).toBeInstanceOf(HttpException);
            expect(e.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
            expect(e.getResponse()).toMatchObject({ statusCode: 429, retryAfterMs: 5_000 });
        }
    });
});
