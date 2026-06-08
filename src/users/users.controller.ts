import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { Roles } from '../auth/decorators/roles.decorator';


@ApiTags('users')
@ApiBearerAuth()
@Controller('admin/users')
@Roles('ADMIN') // Applied to the entire controller
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Post()
    @ApiOperation({ summary: 'Create a user (STUDENT or TEACHER) — admin only' })
    create(@Body() dto: CreateUserDto) {
        return this.usersService.createUser(dto);
    }

    @Get()
    @ApiOperation({ summary: 'List users with filters and pagination' })
    list(@Query() query: ListUsersQueryDto) {
        return this.usersService.listUsers(query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a single user by id' })
    findOne(@Param('id') id: string) {
        return this.usersService.findById(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update a user (name, email, role)' })
    update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
        return this.usersService.updateUser(id, dto);
    }

    @Delete(':id')
    @HttpCode(200)
    @ApiOperation({ summary: 'Delete a user' })
    remove(@Param('id') id: string) {
        return this.usersService.deleteUser(id);
    }
}