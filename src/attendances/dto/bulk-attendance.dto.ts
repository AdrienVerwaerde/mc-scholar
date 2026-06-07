import { ApiProperty } from '@nestjs/swagger';
import { AttendanceStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsString, ValidateNested } from 'class-validator';

export class AttendanceEntryDto {
    @ApiProperty({ example: 'cm123...' })
    @IsString()
    studentId!: string;

    @ApiProperty({ enum: AttendanceStatus, example: 'PRESENT' })
    @IsEnum(AttendanceStatus)
    status!: AttendanceStatus;
}

export class BulkAttendanceDto {
    @ApiProperty({ type: [AttendanceEntryDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AttendanceEntryDto)
    attendances!: AttendanceEntryDto[];
}
