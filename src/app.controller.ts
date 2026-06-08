import { Controller, Get } from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { AppService } from './app.service';
import { ApiExcludeEndpoint } from '@nestjs/swagger';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  @ApiExcludeEndpoint() // This route will be hidden from Swagger documentation
  getHello(): string {
    return this.appService.getHello();
  }

  // Protected route: requires a valid session
  @Get('me')
  getMe(@Session() session: UserSession) {
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: (session.user as any).role,
    };
  }
}
