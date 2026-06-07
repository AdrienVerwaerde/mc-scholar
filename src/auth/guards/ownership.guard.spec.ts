import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { OwnershipGuard } from './ownership.guard';

const makeConfig = (overrides?: Partial<{ model: string; paramKey: string; ownerField: string }>) => ({
    model: 'course',
    paramKey: 'id',
    ownerField: 'teacherId',
    ...overrides,
});

const makeContext = (
    user: object | null,
    config: object | undefined,
    params: Record<string, string> = {},
) => {
    const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue(config),
    } as unknown as Reflector;

    const ctx = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: () => ({
            getRequest: () => ({
                session: user ? { user } : undefined,
                params,
            }),
        }),
    } as any;

    return { reflector, ctx };
};

describe('OwnershipGuard', () => {
    it('passes when no ownership config is defined on the route', async () => {
        const prisma = {} as any;
        const { reflector, ctx } = makeContext(null, undefined);
        const guard = new OwnershipGuard(reflector, prisma);

        await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('throws UnauthorizedException when user is not authenticated', async () => {
        const prisma = {} as any;
        const { reflector, ctx } = makeContext(null, makeConfig());
        const guard = new OwnershipGuard(reflector, prisma);

        await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it('passes immediately for ADMIN (bypasses ownership check)', async () => {
        const prisma = {} as any;
        const { reflector, ctx } = makeContext({ id: 'a1', role: Role.ADMIN }, makeConfig());
        const guard = new OwnershipGuard(reflector, prisma);

        await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('throws NotFoundException when resource param is missing', async () => {
        const prisma = {} as any;
        const { reflector, ctx } = makeContext({ id: 't1', role: Role.TEACHER }, makeConfig(), {});
        const guard = new OwnershipGuard(reflector, prisma);

        await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when resource does not exist in DB', async () => {
        const prisma = { course: { findUnique: jest.fn().mockResolvedValue(null) } } as any;
        const { reflector, ctx } = makeContext(
            { id: 't1', role: Role.TEACHER },
            makeConfig(),
            { id: 'c1' },
        );
        const guard = new OwnershipGuard(reflector, prisma);

        await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user does not own the resource', async () => {
        const prisma = {
            course: { findUnique: jest.fn().mockResolvedValue({ teacherId: 'other-teacher' }) },
        } as any;
        const { reflector, ctx } = makeContext(
            { id: 't1', role: Role.TEACHER },
            makeConfig(),
            { id: 'c1' },
        );
        const guard = new OwnershipGuard(reflector, prisma);

        await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('passes when user owns the resource', async () => {
        const prisma = {
            course: { findUnique: jest.fn().mockResolvedValue({ teacherId: 't1' }) },
        } as any;
        const { reflector, ctx } = makeContext(
            { id: 't1', role: Role.TEACHER },
            makeConfig(),
            { id: 'c1' },
        );
        const guard = new OwnershipGuard(reflector, prisma);

        await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('throws Error when Prisma model does not exist', async () => {
        const prisma = {} as any; // no 'course' key
        const { reflector, ctx } = makeContext(
            { id: 't1', role: Role.TEACHER },
            makeConfig({ model: 'nonexistent' }),
            { id: 'x1' },
        );
        const guard = new OwnershipGuard(reflector, prisma);

        await expect(guard.canActivate(ctx)).rejects.toThrow(/Unknown Prisma model/);
    });
});
