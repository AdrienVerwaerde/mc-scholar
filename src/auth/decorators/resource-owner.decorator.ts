import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { OwnershipGuard } from '../guards/ownership.guard';

export const RESOURCE_OWNER_KEY = 'resourceOwner';

export type ResourceOwnerConfig = {
    /** Prisma model name (e.g. 'course', 'grade') */
    model: string;
    /** URL param name holding the resource id */
    paramKey: string;
    /** Model field referencing the owner */
    ownerField: string;
};

export const RequireOwnership = (config: ResourceOwnerConfig) =>
    applyDecorators(
        SetMetadata(RESOURCE_OWNER_KEY, config),
        UseGuards(OwnershipGuard),
    );
