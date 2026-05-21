import { ApiProperty } from '@nestjs/swagger';
import {
    IsInt,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    Min,
    MinLength,
} from 'class-validator';

export class CreateCourseDto {
    @ApiProperty({ example: 'MATH101' })
    @IsString()
    @Matches(/^[A-Z]{2,5}[0-9]{2,4}$/, {
        message: 'code must match the pattern: 2-5 uppercase letters + 2-4 digits',
    })
    code!: string;

    @ApiProperty({ example: 'Algebra and Calculus 101' })
    @IsString()
    @MinLength(3)
    @MaxLength(100)
    title!: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @ApiProperty({ example: 30, minimum: 1 })
    @IsInt()
    @Min(1)
    capacity!: number;

    @ApiProperty({ example: '2026-S1' })
    @IsString()
    @Matches(/^\d{4}-S[12]$/, {
        message: 'semester must match: YYYY-S1 or YYYY-S2',
    })
    semester!: string;
}