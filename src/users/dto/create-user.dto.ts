import { ApiProperty } from '@nestjs/swagger';
import {
    IsEmail,
    IsEnum,
    IsString,
    MinLength,
} from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
    @ApiProperty({ example: 'jane.doe@school.edu' })
    @IsEmail()
    email!: string;

    @ApiProperty({ example: 'Jane Doe' })
    @IsString()
    @MinLength(2)
    name!: string;

    @ApiProperty({ example: 'temporary-password-123', minLength: 8 })
    @IsString()
    @MinLength(8)
    password!: string;

    @ApiProperty({ enum: Role, example: Role.STUDENT })
    @IsEnum(Role)
    role!: Role;
}