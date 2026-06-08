import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { auth } from '../auth/auth.config';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Creates a user with a specific role via Better Auth's API,
     * then promotes/demotes them in a single transaction.
     * Throws ConflictException if the email is already taken.
     */
    async createUser(dto: CreateUserDto) {
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (existing) {
            throw new ConflictException(`Email "${dto.email}" is already used`);
        }

        // Better Auth creates the user with role=STUDENT (default)
        await auth.api.signUpEmail({
            body: {
                email: dto.email,
                password: dto.password,
                name: dto.name,
            },
        });

        // Then we set the actual role
        return this.prisma.user.update({
            where: { email: dto.email },
            data: { role: dto.role },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
            },
        });
    }

    /**
     * Paginated list with optional role filter and name/email search.
     */
    async listUsers(query: ListUsersQueryDto) {
        const where = {
            ...(query.role && { role: query.role }),
            ...(query.search && {
                OR: [
                    { name: { contains: query.search, mode: 'insensitive' as const } },
                    { email: { contains: query.search, mode: 'insensitive' as const } },
                ],
            }),
        };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.user.findMany({
                where,
                skip: (query.page - 1) * query.limit,
                take: query.limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    createdAt: true,
                },
            }),
            this.prisma.user.count({ where }),
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

    /** Updates name, email, role, or password of an existing user. */
    async updateUser(id: string, dto: UpdateUserDto) {
        await this.findById(id);
        return this.prisma.user.update({
            where: { id },
            data: {
                ...(dto.name && { name: dto.name }),
                ...(dto.email && { email: dto.email }),
                ...(dto.role && { role: dto.role }),
            },
            select: { id: true, email: true, name: true, role: true, createdAt: true },
        });
    }

    /** Deletes a user by id. */
    async deleteUser(id: string) {
        await this.findById(id);
        await this.prisma.user.delete({ where: { id } });
        return { deleted: true };
    }

    /** Returns a user by id, or 404. */
    async findById(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
            },
        });
        if (!user) {
            throw new NotFoundException(`User ${id} not found`);
        }
        return user;
    }
}