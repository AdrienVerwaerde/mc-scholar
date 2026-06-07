import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GradesService } from './grades.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';
import { ListGradesQueryDto } from './dto/list-grades.query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('grades')
@ApiBearerAuth()
@Controller('grades')
export class GradesController {
    constructor(private readonly gradesService: GradesService) { }

    @Post()
    @Roles('TEACHER', 'ADMIN')
    @ApiOperation({ summary: 'Record a grade (TEACHER on own course, or ADMIN)' })
    create(
        @Body() dto: CreateGradeDto,
        @CurrentUser() caller: AuthenticatedUser,
    ) {
        return this.gradesService.create(dto, caller);
    }

    @Get()
    @ApiOperation({
        summary:
            'List grades. STUDENT sees own; TEACHER sees own courses; ADMIN sees all.',
    })
    list(
        @Query() query: ListGradesQueryDto,
        @CurrentUser() caller: AuthenticatedUser,
    ) {
        return this.gradesService.listForCaller(caller, query);
    }

    @Patch(':id')
    @Roles('TEACHER', 'ADMIN')
    @ApiOperation({ summary: 'Update a grade (owner of the course, or ADMIN)' })
    update(
        @Param('id') id: string,
        @Body() dto: UpdateGradeDto,
        @CurrentUser() caller: AuthenticatedUser,
    ) {
        return this.gradesService.update(id, dto, caller);
    }

    @Delete(':id')
    @Roles('TEACHER', 'ADMIN')
    @ApiOperation({ summary: 'Delete a grade (owner of the course, or ADMIN)' })
    remove(
        @Param('id') id: string,
        @CurrentUser() caller: AuthenticatedUser,
    ) {
        return this.gradesService.remove(id, caller);
    }
}