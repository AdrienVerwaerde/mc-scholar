import { Module } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { CoursesModule } from '../courses/courses.module';
import { EnrollmentsController } from './enrollments.controler';

@Module({
    imports: [CoursesModule], // for CourseCapacityPipe
    controllers: [EnrollmentsController],
    providers: [EnrollmentsService],
})
export class EnrollmentsModule { }