import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';


@Module({
  imports: [PrismaModule, AuthModule, RateLimitModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
