import { Module } from '@nestjs/common';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './auth.config';
import { RolesGuard } from './guards/roles.guard';
import { OwnershipGuard } from './guards/ownership.guard';

@Module({
    imports: [BetterAuthModule.forRoot({ auth })],
    providers: [RolesGuard, OwnershipGuard],
    exports: [RolesGuard, OwnershipGuard],
})
export class AuthModule { }