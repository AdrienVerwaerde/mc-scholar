import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Put,
    Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { SetWeightsDto } from './dto/set-weights.dto';
import { ListCoursesQueryDto } from './dto/list-courses.query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireOwnership } from '../auth/decorators/resource-owner.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('courses')
@ApiBearerAuth()
@Controller('courses')
export class CoursesController {
    constructor(private readonly coursesService: CoursesService) { }

    // Public catalog — any authenticated user
    @Get()
    @ApiOperation({ summary: 'List courses with filters + pagination' })
    list(@Query() query: ListCoursesQueryDto) {
        return this.coursesService.list(query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a course by id' })
    findOne(@Param('id') id: string) {
        return this.coursesService.findOne(id);
    }

    // TEACHER creates a course they own; ADMIN can also create.
    // When the creator is a TEACHER, they automatically become the course's teacher.
    @Post()
    @Roles('TEACHER', 'ADMIN')
    @ApiOperation({ summary: 'Create a course (teacher becomes the owner)' })
    create(
        @Body() dto: CreateCourseDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.coursesService.create(dto, user.id);
    }

    // Update: only the owning teacher (or admin) can update.
    @Patch(':id')
    @Roles('TEACHER', 'ADMIN')
    @RequireOwnership({ model: 'course', paramKey: 'id', ownerField: 'teacherId' })
    @ApiOperation({ summary: 'Update a course (owner or admin)' })
    update(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
        return this.coursesService.update(id, dto);
    }

    @Delete(':id')
    @Roles('TEACHER', 'ADMIN')
    @RequireOwnership({ model: 'course', paramKey: 'id', ownerField: 'teacherId' })
    @ApiOperation({ summary: 'Delete a course (owner or admin)' })
    remove(@Param('id') id: string) {
        return this.coursesService.remove(id);
    }

    // Replace the evaluation weights for a course
    @Put(':id/weights')
    @Roles('TEACHER', 'ADMIN')
    @RequireOwnership({ model: 'course', paramKey: 'id', ownerField: 'teacherId' })
    @ApiOperation({ summary: 'Set evaluation weights for a course (must sum to 1)' })
    setWeights(@Param('id') id: string, @Body() dto: SetWeightsDto) {
        return this.coursesService.setWeights(id, dto);
    }
}