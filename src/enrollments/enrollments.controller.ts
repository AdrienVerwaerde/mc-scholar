import {
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EnrollmentsService } from './enrollments.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CourseCapacityPipe } from '../courses/pipes/course-capacity.pipe';
import type { CourseWithCapacityCheck } from '../courses/pipes/course-capacity.pipe';


@ApiTags('enrollments')
@ApiBearerAuth()
@Controller()
export class EnrollmentsController {
    constructor(private readonly enrollmentsService: EnrollmentsService) { }

    /**
     * Enroll the current student in a course.
     * The CourseCapacityPipe rejects with 409 if the course is full,
     * and 404 if it does not exist — before the controller body runs.
     */
    @Post('courses/:id/enroll')
    @Roles('STUDENT')
    @ApiOperation({ summary: 'Enroll the current student in a course' })
    enroll(
        @Param('id', CourseCapacityPipe) course: CourseWithCapacityCheck,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.enrollmentsService.enroll(course.id, user.id);
    }

    @Delete('courses/:id/enroll')
    @Roles('STUDENT')
    @HttpCode(200)
    @ApiOperation({ summary: 'Remove the current student from a course' })
    unenroll(
        @Param('id') courseId: string,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.enrollmentsService.unenroll(courseId, user.id);
    }

    @Get('me/enrollments')
    @Roles('STUDENT')
    @ApiOperation({ summary: 'List the current student enrollments' })
    listMine(@CurrentUser() user: AuthenticatedUser) {
        return this.enrollmentsService.listMine(user.id);
    }
}