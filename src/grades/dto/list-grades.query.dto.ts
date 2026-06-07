import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { EvaluationType } from '@prisma/client';

export class ListGradesQueryDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    courseId?: string;

    @ApiPropertyOptional({ enum: EvaluationType })
    @IsOptional()
    @IsEnum(EvaluationType)
    type?: EvaluationType;
}