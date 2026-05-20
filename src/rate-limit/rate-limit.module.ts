import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import { RateLimitMiddleware } from './rate-limit.middleware';

@Module({
    providers: [RateLimitService, RateLimitMiddleware],
    exports: [RateLimitService],
})
export class RateLimitModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        // Applique le rate limiting à TOUTES les routes
        consumer.apply(RateLimitMiddleware).forRoutes('*');
    }
}