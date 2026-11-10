import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RoleCode } from '@prisma/client';
import { AppError } from './app-error.js';
import { ROLES, type AuthedRequest } from './auth.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RoleCode[] | undefined>(ROLES, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
    if (user && user.roles.some((r) => required.includes(r))) return true;
    throw new AppError(403, 'forbidden', 'You do not have access to this');
  }
}
