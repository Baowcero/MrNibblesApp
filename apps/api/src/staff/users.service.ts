import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { Prisma, type RoleCode } from '@prisma/client';
import { randomInt } from 'node:crypto';
import { AuditService } from '../audit/audit.service.js';
import { AppError } from '../common/app-error.js';
import { normalizePhone } from '../common/phone.js';
import { PrismaService } from '../prisma/prisma.service.js';

const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
const tempPassword = () => Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('') + '7';

@Injectable()
export class StaffUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Creates a staff or distributor login with a temporary password, shown once. */
  async create(actorId: string, input: { fullName: string; phone: string; roles: RoleCode[] }) {
    const phone = normalizePhone(input.phone);
    if (!phone) throw new AppError(400, 'invalid_phone', 'Enter a valid Nigerian phone number');
    const roles = [...new Set(input.roles)];
    const password = tempPassword();

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const roleRows = await tx.role.findMany({ where: { code: { in: roles } } });
        const created = await tx.user.create({
          data: {
            phone,
            passwordHash: await argon2.hash(password),
            fullName: input.fullName.trim(),
            mustChangePassword: true,
            roles: { create: roleRows.map((r) => ({ roleId: r.id })) },
          },
        });
        if (roles.includes('distributor')) await tx.distributor.create({ data: { userId: created.id } });
        await tx.auditLog.create({
          data: { actorUserId: actorId, action: 'user.create', entityType: 'user', entityId: created.id, after: { roles, phone } },
        });
        return created;
      });
      return { id: user.id, full_name: user.fullName, phone, roles, temporary_password: password };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppError(409, 'phone_taken', 'A user with this phone number already exists');
      }
      throw e;
    }
  }

  async list(role?: RoleCode) {
    const code: Prisma.RoleWhereInput['code'] = role ?? { not: 'customer' };
    const users = await this.prisma.user.findMany({
      where: { roles: { some: { role: { code } } } },
      orderBy: { fullName: 'asc' },
      include: { roles: { include: { role: true } }, distributor: true },
    });
    return {
      data: users.map((u) => ({
        id: u.id,
        full_name: u.fullName,
        phone: u.phone,
        is_active: u.isActive,
        roles: u.roles.map((r) => r.role.code),
        distributor_id: u.distributor?.id ?? null,
        last_login_at: u.lastLoginAt,
      })),
    };
  }

  async resetPassword(actorId: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, 'user_not_found', 'User not found');
    const password = tempPassword();
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await argon2.hash(password), mustChangePassword: true } }),
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.auditLog.create({ data: { actorUserId: actorId, action: 'user.reset_password', entityType: 'user', entityId: userId } }),
    ]);
    return { id: userId, temporary_password: password };
  }

  async setActive(actorId: string, userId: string, active: boolean) {
    if (!active && actorId === userId) throw new AppError(409, 'cannot_disable_self', 'You cannot disable your own account');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, 'user_not_found', 'User not found');
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { isActive: active } }),
      ...(active ? [] : [this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })]),
      this.prisma.distributor.updateMany({ where: { userId }, data: { isActive: active } }),
      this.prisma.auditLog.create({
        data: { actorUserId: actorId, action: active ? 'user.activate' : 'user.deactivate', entityType: 'user', entityId: userId },
      }),
    ]);
    return { id: userId, is_active: active };
  }

  /** Active distributors, for the "assign to" list. */
  async distributors() {
    const rows = await this.prisma.distributor.findMany({
      where: { isActive: true, user: { isActive: true } },
      include: { user: true },
      orderBy: { user: { fullName: 'asc' } },
    });
    return { data: rows.map((d) => ({ id: d.id, full_name: d.user.fullName, phone: d.user.phone })) };
  }
}
