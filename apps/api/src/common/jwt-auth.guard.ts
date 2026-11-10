import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { jwtVerify } from 'jose';
import type { RoleCode } from '@prisma/client';
import { accessSecret } from '../config.js';
import { AppError } from './app-error.js';
import { ALLOW_PASSWORD_CHANGE, IS_PUBLIC, type AuthedRequest } from './auth.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new AppError(401, 'unauthorized', 'Please log in to continue');

    try {
      const { payload } = await jwtVerify(token, accessSecret(), { algorithms: ['HS256'] });
      req.user = {
        id: String(payload.sub),
        roles: payload.roles as RoleCode[],
        mustChangePassword: payload.mcp === true,
      };
    } catch {
      throw new AppError(401, 'token_invalid', 'Your session has expired. Please log in again.');
    }

    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_CHANGE, targets);
    if (req.user.mustChangePassword && !allowed) {
      throw new AppError(403, 'password_change_required', 'Set a new password to continue');
    }
    return true;
  }
}
