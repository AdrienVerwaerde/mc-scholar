import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { RolesGuard } from '../guards/roles.guard';

export const ROLES_KEY = 'roles';

/**
 * Restricts route or controller access to the specified roles.
 * Bundles @UseGuards(RolesGuard) so the role check runs AFTER
 * Better Auth's global AuthGuard (i.e. with session populated).
 */
export const Roles = (...roles: Role[]) =>
    applyDecorators(
        SetMetadata(ROLES_KEY, roles),
        UseGuards(RolesGuard),
    );
