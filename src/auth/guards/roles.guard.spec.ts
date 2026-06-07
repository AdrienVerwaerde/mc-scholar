import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

const makeContext = (user: object | null, handlerRoles: Role[] | undefined) => {
    const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue(handlerRoles),
    } as unknown as Reflector;

    const guard = new RolesGuard(reflector);

    const ctx = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: () => ({
            getRequest: () => ({ session: user ? { user } : undefined }),
        }),
    } as any;

    return { guard, ctx };
};

describe('RolesGuard', () => {
    it('passes when no roles are required (open route)', () => {
        const { guard, ctx } = makeContext(null, undefined);
        expect(guard.canActivate(ctx)).toBe(true);
    });

    it('passes when roles array is empty', () => {
        const { guard, ctx } = makeContext(null, []);
        expect(guard.canActivate(ctx)).toBe(true);
    });

    it('throws UnauthorizedException when user is not authenticated', () => {
        const { guard, ctx } = makeContext(null, [Role.ADMIN]);
        expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('throws ForbiddenException when user has wrong role', () => {
        const { guard, ctx } = makeContext({ role: Role.STUDENT }, [Role.ADMIN]);
        expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('passes when user has the required role', () => {
        const { guard, ctx } = makeContext({ role: Role.TEACHER }, [Role.TEACHER]);
        expect(guard.canActivate(ctx)).toBe(true);
    });

    it('passes when user has one of multiple required roles', () => {
        const { guard, ctx } = makeContext({ role: Role.ADMIN }, [Role.TEACHER, Role.ADMIN]);
        expect(guard.canActivate(ctx)).toBe(true);
    });
});
