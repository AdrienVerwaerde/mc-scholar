import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { SetWeightsDto } from './dto/set-weights.dto';
import { ListCoursesQueryDto } from './dto/list-courses.query.dto';

@Injectable()
export class CoursesService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Creates a course owned by the calling teacher.
     * Admins must pass a teacherId explicitly (different overload not exposed here for simplicity).
     */
    async create(dto: CreateCourseDto, teacherId: string) {
        const existing = await this.prisma.course.findUnique({
            where: { code: dto.code },
        });
        if (existing) {
            throw new ConflictException(`Course code "${dto.code}" already exists`);
        }

        return this.prisma.course.create({
            data: { ...dto, teacherId },
            include: this.includeRelations(),
        });
    }

    /** Public listing with filters + pagination. */
    async list(query: ListCoursesQueryDto) {
        const where: Prisma.CourseWhereInput = {
            ...(query.semester && { semester: query.semester }),
            ...(query.teacherId && { teacherId: query.teacherId }),
            ...(query.search && {
                OR: [
                    { code: { contains: query.search, mode: 'insensitive' } },
                    { title: { contains: query.search, mode: 'insensitive' } },
                ],
            }),
        };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.course.findMany({
                where,
                skip: (query.page - 1) * query.limit,
                take: query.limit,
                orderBy: [{ semester: 'desc' }, { code: 'asc' }],
                include: this.includeRelations(),
            }),
            this.prisma.course.count({ where }),
        ]);

        return {
            items,
            pagination: {
                page: query.page,
                limit: query.limit,
                total,
                totalPages: Math.ceil(total / query.limit),
            },
        };
    }

    async findOne(id: string) {
        const course = await this.prisma.course.findUnique({
            where: { id },
            include: this.includeRelations(),
        });
        if (!course) throw new NotFoundException(`Course ${id} not found`);
        return course;
    }

    async update(id: string, dto: UpdateCourseDto) {
        await this.assertExists(id);
        return this.prisma.course.update({
            where: { id },
            data: dto,
            include: this.includeRelations(),
        });
    }

    async remove(id: string) {
        await this.assertExists(id);
        await this.prisma.course.delete({ where: { id } });
        return { deleted: true };
    }

    /**
     * Replaces the entire weights configuration for a course.
     * Enforces that the weights sum to exactly 1 (with a 0.001 epsilon for floating-point safety).
     * Atomic: delete + recreate in a transaction.
     */
    async setWeights(courseId: string, dto: SetWeightsDto) {
        await this.assertExists(courseId);

        const sum = dto.weights.reduce((acc, w) => acc + w.weight, 0);
        if (Math.abs(sum - 1) > 0.001) {
            throw new BadRequestException(
                `Weights must sum to 1 (currently ${sum.toFixed(3)})`,
            );
        }

        const types = dto.weights.map((w) => w.type);
        if (new Set(types).size !== types.length) {
            throw new BadRequestException('Duplicate evaluation types in weights');
        }

        await this.prisma.$transaction([
            this.prisma.evaluationWeight.deleteMany({ where: { courseId } }),
            this.prisma.evaluationWeight.createMany({
                data: dto.weights.map((w) => ({ courseId, ...w })),
            }),
        ]);

        return this.findOne(courseId);
    }

    /**
     * Used by the controller to verify a teacher updating a course
     * is the actual owner. Throws ForbiddenException if not.
     * (We could use OwnershipGuard but here we want a clearer error message
     * specific to the "teacher" semantics.)
     */
    async assertTeacherOwns(courseId: string, teacherId: string) {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
            select: { teacherId: true },
        });
        if (!course) throw new NotFoundException(`Course ${courseId} not found`);
        if (course.teacherId !== teacherId) {
            throw new ForbiddenException('You do not teach this course');
        }
    }

    // ----- helpers -----

    private async assertExists(id: string) {
        const exists = await this.prisma.course.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!exists) throw new NotFoundException(`Course ${id} not found`);
    }

    private includeRelations() {
        return {
            teacher: {
                select: { id: true, name: true, email: true },
            },
            evaluationWeights: {
                select: { type: true, weight: true },
            },
            _count: {
                select: { enrollments: true },
            },
        };
    }
}