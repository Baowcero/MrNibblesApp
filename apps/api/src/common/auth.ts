import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { RoleCode } from '@prisma/client';

export const IS_PUBLIC = 'isPublic';
export const ALLOW_PASSWORD_CHANGE = 'allowPasswordChange';
export const ROLES = 'roles';

/** Route needs no login. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Route may be used while the user still has to set a new password. */
export const AllowPasswordChange = () => SetMetadata(ALLOW_PASSWORD_CHANGE, true);
/** Route is limited to these roles. */
export const Roles = (...roles: RoleCode[]) => SetMetadata(ROLES, roles);

export class AuthUser {
  id!: string;
  roles!: RoleCode[];
  mustChangePassword!: boolean;
}

export type AuthedRequest = Request & { user?: AuthUser };

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest<AuthedRequest>().user!,
);
