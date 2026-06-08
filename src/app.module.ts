import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { UsersModule } from './users/users.module';
import { CoursesModule } from './courses/courses.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { GradesModule } from './grades/grades.module';
import { AttendancesModule } from './attendances/attendances.module';
import { AdminModule } from './admin/admin.module';


@Module({
  imports: [
    PrismaModule,
    AuthModule,
    RateLimitModule,
    UsersModule,
    CoursesModule,
    EnrollmentsModule,
    GradesModule,
    AttendancesModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
