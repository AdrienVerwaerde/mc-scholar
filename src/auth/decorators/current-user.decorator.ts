import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';

export interface AuthenticatedUser {
    id: string;
    email: string;
    name: string;
    role: Role;
}

/**
 * Extracts the authenticated user from the current session.
 */
export const CurrentUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
        const request = ctx.switchToHttp().getRequest();
        const user = request.session?.user;
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        };
    },
);
