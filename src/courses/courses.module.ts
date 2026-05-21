import { Module } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CourseCapacityPipe } from './pipes/course-capacity.pipe';
import { CoursesController } from './ courses.controller';

@Module({
    controllers: [CoursesController],
    providers: [CoursesService, CourseCapacityPipe],
    exports: [CoursesService, CourseCapacityPipe],
})
export class CoursesModule { }