import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import { RateLimitMiddleware } from './rate-limit.middleware';

@Module({
    providers: [RateLimitService, RateLimitMiddleware],
    exports: [RateLimitService],
})
export class RateLimitModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        // Applies rate limiting to ALL routes
        consumer.apply(RateLimitMiddleware).forRoutes('*');
    }
}