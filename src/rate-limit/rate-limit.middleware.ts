import {
    Injectable,
    NestMiddleware,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { RateLimitService } from './rate-limit.service';

/**
 * Middleware de rate limiting global.
 *
 * Identifie le client par userId si authentifié, sinon par IP.
 * Renvoie 429 + header Retry-After au-delà du seuil.
 *
 * Configuration via variables d'environnement :
 * - RATE_LIMIT_MAX (default 100)
 * - RATE_LIMIT_WINDOW_MS (default 60000)
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
    private readonly maxRequests: number;
    private readonly windowMs: number;

    constructor(private readonly rateLimitService: RateLimitService) {
        this.maxRequests = Number(process.env.RATE_LIMIT_MAX ?? 100);
        this.windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
    }

    use(req: Request, res: Response, next: NextFunction): void {
        const clientId = this.resolveClientId(req);

        const result = this.rateLimitService.check(clientId, {
            maxRequests: this.maxRequests,
            windowMs: this.windowMs,
        });

        // Headers informatifs (standard HTTP)
        res.setHeader('X-RateLimit-Limit', this.maxRequests);
        res.setHeader('X-RateLimit-Remaining', result.remaining);

        if (!result.allowed) {
            const retryAfterSec = Math.ceil(result.retryAfterMs / 1000);
            res.setHeader('Retry-After', retryAfterSec);
            throw new HttpException(
                {
                    statusCode: HttpStatus.TOO_MANY_REQUESTS,
                    message: 'Too many requests',
                    retryAfterMs: result.retryAfterMs,
                },
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        next();
    }

    /**
     * Préfère userId si authentifié, sinon retombe sur l'IP.
     * On préfixe pour éviter qu'un user avec un id numérique
     * entre en collision avec une IP du même format.
     */
    private resolveClientId(req: Request): string {
        const userId = (req as any).session?.user?.id;
        if (userId) {
            return `user:${userId}`;
        }
        const ip =
            req.ip ??
            (req.headers['x-forwarded-for'] as string) ??
            req.socket?.remoteAddress ??
            'unknown';
        return `ip:${ip}`;
    }
}