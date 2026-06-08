import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsEnum,
    IsNumber,
    Max,
    Min,
    ValidateNested,
} from 'class-validator';
import { EvaluationType } from '@prisma/client';

export class WeightItemDto {
    @ApiProperty({ enum: EvaluationType })
    @IsEnum(EvaluationType)
    type!: EvaluationType;

    @ApiProperty({ minimum: 0.01, maximum: 1, example: 0.6 })
    @IsNumber()
    @Min(0.01)
    @Max(1)
    weight!: number;
}

export class SetWeightsDto {
    @ApiProperty({ type: [WeightItemDto] })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => WeightItemDto)
    weights!: WeightItemDto[];
}