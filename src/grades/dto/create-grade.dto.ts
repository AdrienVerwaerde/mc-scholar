import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
} from 'class-validator';
import { EvaluationType } from '@prisma/client';

export class CreateGradeDto {
    @ApiProperty({ example: 'cm123...' })
    @IsString()
    studentId!: string;

    @ApiProperty({ example: 'cm456...' })
    @IsString()
    courseId!: string;

    @ApiProperty({ enum: EvaluationType, example: 'EXAM' })
    @IsEnum(EvaluationType)
    type!: EvaluationType;

    @ApiProperty({ example: 14.5, minimum: 0, maximum: 20 })
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @Max(20)
    value!: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(300)
    comment?: string;
}