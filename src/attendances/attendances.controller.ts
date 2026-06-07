import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AttendancesService } from './attendances.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { BulkAttendanceDto } from './dto/bulk-attendance.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('attendances')
@ApiBearerAuth()
@Controller()
export class AttendancesController {
    constructor(private readonly attendancesService: AttendancesService) { }

    @Post('courses/:courseId/sessions')
    @Roles('TEACHER', 'ADMIN')
    @ApiOperation({ summary: 'Create a class session for a course (TEACHER of that course or ADMIN)' })
    createSession(
        @Param('courseId') courseId: string,
        @Body() dto: CreateSessionDto,
        @CurrentUser() caller: AuthenticatedUser,
    ) {
        return this.attendancesService.createSession(courseId, dto, caller);
    }

    @Get('courses/:courseId/sessions')
    @ApiOperation({ summary: 'List sessions for a course (TEACHER owns it; STUDENT enrolled; ADMIN any)' })
    listSessions(
        @Param('courseId') courseId: string,
        @CurrentUser() caller: AuthenticatedUser,
    ) {
        return this.attendancesService.listSessions(courseId, caller);
    }

    @Post('sessions/:sessionId/attendances')
    @Roles('TEACHER', 'ADMIN')
    @ApiOperation({ summary: 'Bulk-record attendances for a session (upsert, all-or-nothing)' })
    bulkRecord(
        @Param('sessionId') sessionId: string,
        @Body() dto: BulkAttendanceDto,
        @CurrentUser() caller: AuthenticatedUser,
    ) {
        return this.attendancesService.bulkRecord(sessionId, dto, caller);
    }
}
