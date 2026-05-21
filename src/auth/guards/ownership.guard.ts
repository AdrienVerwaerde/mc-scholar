import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
    RESOURCE_OWNER_KEY,
    ResourceOwnerConfig,
} from '../decorators/resource-owner.decorator';

@Injectable()
export class OwnershipGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly prisma: PrismaService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const config = this.reflector.getAllAndOverride<ResourceOwnerConfig>(
            RESOURCE_OWNER_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (!config) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.session?.user;

        if (!user) {
            throw new UnauthorizedException('Authentication required');
        }

        if (user.role === Role.ADMIN) {
            return true;
        }

        const resourceId = request.params[config.paramKey];
        if (!resourceId) {
            throw new NotFoundException(`Missing param "${config.paramKey}"`);
        }

        const model = (this.prisma as any)[config.model];
        if (!model) {
            throw new Error(`Unknown Prisma model: ${config.model}`);
        }

        const resource = await model.findUnique({
            where: { id: resourceId },
            select: { [config.ownerField]: true },
        });

        if (!resource) {
            throw new NotFoundException(`${config.model} not found`);
        }

        if (resource[config.ownerField] !== user.id) {
            throw new ForbiddenException('You do not own this resource');
        }

        return true;
    }
}
