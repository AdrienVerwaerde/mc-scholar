import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsNumber,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
} from 'class-validator';

export class UpdateGradeDto {
    @ApiProperty({ example: 15, minimum: 0, maximum: 20, required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @Max(20)
    value?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(300)
    comment?: string;
}