import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Verifies the authenticated user has one of the roles declared via @Roles().
 * Applied via @UseGuards in the @Roles() decorator → guaranteed to run
 * AFTER Better Auth's global guard (request.session is populated).
 */
@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.session?.user;

        if (!user) {
            throw new UnauthorizedException('Authentication required');
        }

        const userRole = user.role as Role;

        if (!requiredRoles.includes(userRole)) {
            throw new ForbiddenException(
                `Access restricted to: ${requiredRoles.join(', ')}`,
            );
        }

        return true;
    }
}
