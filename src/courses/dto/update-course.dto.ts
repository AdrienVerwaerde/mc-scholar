import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateCourseDto } from './create-course.dto';

// All fields optional, except `code` which is immutable after creation
export class UpdateCourseDto extends PartialType(
    OmitType(CreateCourseDto, ['code'] as const),
) { }