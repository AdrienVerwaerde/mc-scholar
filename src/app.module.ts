import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { UsersModule } from './users/users.module';


@Module({
  imports: [PrismaModule, AuthModule, RateLimitModule, UsersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
