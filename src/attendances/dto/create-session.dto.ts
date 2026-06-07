import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSessionDto {
    @ApiProperty({ example: '2026-06-10T08:00:00.000Z' })
    @Type(() => Date)
    @IsDate()
    date!: Date;

    @ApiPropertyOptional({ example: 'Introduction to derivatives' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    topic?: string;
}
