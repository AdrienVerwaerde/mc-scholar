import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetAverageQueryDto {
    @ApiProperty({ description: 'Course to compute the average for' })
    @IsString()
    courseId!: string;

    @ApiPropertyOptional({ description: 'Student id (TEACHER / ADMIN only)' })
    @IsOptional()
    @IsString()
    studentId?: string;
}
