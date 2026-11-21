import { notifyRoles } from '../notifications/queue.js';
import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { Prisma, type RoleCode } from '@prisma/client';
import { AppError } from '../common/app-error.js';
import { normalizePhone } from '../common/phone.js';
import { RateLimiter } from '../common/rate-limit.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ChangePasswordDto, LocationDto, LoginDto, SignupDto, UpdateLocationDto, UpdateProfileDto } from './dto.js';
import { TokensService, hashToken } from './tokens.service.js';

const WITH_ROLES = { roles: { include: { role: true } } } as const;
const REUSE_GRACE_MS = 10_000;

let dummyHash: Promise<string> | undefined;
/** Verified when the phone is unknown, so response time does not reveal which phones exist. */
const getDummyHash = () => (dummyHash ??= argon2.hash('not-a-real-password'));

type UserWithRoles = Prisma.UserGetPayload<{ include: typeof WITH_ROLES }>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly limiter: RateLimiter,
  ) {}

  private roleCodes(user: UserWithRoles): RoleCode[] {
    return user.roles.map((r) => r.role.code);
  }

  private async profile(user: UserWithRoles) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: user.id },
      select: { id: true, businessName: true, status: true },
    });
    return {
      id: user.id,
      full_name: user.fullName,
      phone: user.phone,
      email: user.email,
      roles: this.roleCodes(user),
      must_change_password: user.mustChangePassword,
      customer: customer
        ? { id: customer.id, business_name: customer.businessName, status: customer.status }
        : null,
    };
  }

  private issueFor(user: UserWithRoles) {
    return this.tokens.issue({
      id: user.id,
      roles: this.roleCodes(user),
      mustChangePassword: user.mustChangePassword,
    });
  }

  /** 5 wrong passwords per phone and 30 per address in 15 minutes, then a wait. A correct login clears the phone's count. */
  async login(dto: LoginDto, ip = 'unknown') {
    const phone = normalizePhone(dto.phone);
    const phoneKey = `login:phone:${phone ?? dto.phone.replace(/\D/g, '')}`;
    const ipKey = `login:ip:${ip}`;
    if ((await this.limiter.count(phoneKey)) >= 5 || (await this.limiter.count(ipKey)) >= 30) {
      const wait = Math.max(await this.limiter.ttl(phoneKey), await this.limiter.ttl(ipKey), 1);
      throw new AppError(429, 'too_many_attempts', `Too many attempts. Try again in ${Math.ceil(wait / 60)} minute(s).`, { retry_after_seconds: wait });
    }
    const user = phone
      ? await this.prisma.user.findUnique({ where: { phone }, include: WITH_ROLES })
      : null;

    const valid = user
      ? await argon2.verify(user.passwordHash, dto.password)
      : (await argon2.verify(await getDummyHash(), dto.password), false);
    if (!user || !valid) {
      await this.limiter.hit(phoneKey, 900);
      await this.limiter.hit(ipKey, 900);
      throw new AppError(401, 'invalid_credentials', 'Phone number or password is incorrect');
    }
    if (!user.isActive) {
      throw new AppError(403, 'account_disabled', 'This account has been disabled. Contact Mr Nibbles.');
    }

    await this.limiter.reset(phoneKey);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return { ...(await this.issueFor(user)), user: await this.profile(user) };
  }

  async refresh(refreshToken: string) {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: { include: WITH_ROLES } },
    });
    if (!record) throw new AppError(401, 'token_invalid', 'Please log in again');

    if (record.revokedAt) {
      // A token that was already rotated is being used again: likely stolen, so end every session.
      // A short grace period covers two requests refreshing at the same moment (offline sync).
      if (Date.now() - record.revokedAt.getTime() > REUSE_GRACE_MS) {
        await this.tokens.revokeAllForUser(record.userId);
        throw new AppError(401, 'token_reused', 'For your safety, please log in again');
      }
      throw new AppError(401, 'token_invalid', 'Please log in again');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new AppError(401, 'token_expired', 'Your session has expired. Please log in again.');
    }
    if (!record.user.isActive) {
      throw new AppError(403, 'account_disabled', 'This account has been disabled. Contact Mr Nibbles.');
    }

    await this.prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
    return this.issueFor(record.user);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  /** First login for staff accounts created by admin. */
  async setPassword(userId: string, newPassword: string) {
    const user = await this.getUser(userId);
    if (!user.mustChangePassword) {
      throw new AppError(409, 'password_already_set', 'Your password is already set. Use change password instead.');
    }
    return this.replacePassword(user, newPassword);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.getUser(userId);
    if (!(await argon2.verify(user.passwordHash, dto.current_password))) {
      throw new AppError(400, 'wrong_password', 'Your current password is not correct');
    }
    return this.replacePassword(user, dto.new_password);
  }

  private async replacePassword(user: UserWithRoles, newPassword: string) {
    const passwordHash = await argon2.hash(newPassword);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
      include: WITH_ROLES,
    });
    await this.tokens.revokeAllForUser(user.id); // sign out every other device
    return { ...(await this.issueFor(updated)), user: await this.profile(updated) };
  }

  /** Name and email only. The phone number is the login, so it changes through the bakery, not the app. */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: Prisma.UserUpdateInput = {};
    if (dto.full_name !== undefined) data.fullName = dto.full_name.trim();
    if (dto.email !== undefined) data.email = dto.email.trim().toLowerCase() || null;
    const updated = await this.prisma.user.update({ where: { id: userId }, data, include: WITH_ROLES });
    return this.profile(updated);
  }

  // ---------------------------------------------------------------- delivery addresses

  private async myCustomer(userId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) throw new AppError(403, 'not_a_customer', 'This account is not a customer account');
    return customer;
  }

  private async assertArea(areaId: string) {
    const area = await this.prisma.area.findUnique({ where: { id: areaId } });
    if (!area) throw new AppError(400, 'area_not_found', 'Choose an area from the list');
  }

  async addLocation(userId: string, dto: LocationDto) {
    const customer = await this.myCustomer(userId);
    await this.assertArea(dto.area_id);
    await this.prisma.$transaction(async (tx) => {
      const active = await tx.customerLocation.count({ where: { customerId: customer.id, isActive: true } });
      if (active >= 5) throw new AppError(409, 'too_many_locations', 'You can save up to 5 addresses. Remove one first.');
      const makeDefault = dto.is_default === true || active === 0;
      if (makeDefault) await tx.customerLocation.updateMany({ where: { customerId: customer.id }, data: { isDefault: false } });
      await tx.customerLocation.create({
        data: { customerId: customer.id, label: dto.label.trim(), address: dto.address.trim(), areaId: dto.area_id, isDefault: makeDefault },
      });
    });
    return this.me(userId);
  }

  async updateLocation(userId: string, id: string, dto: UpdateLocationDto) {
    const customer = await this.myCustomer(userId);
    const loc = await this.prisma.customerLocation.findFirst({ where: { id, customerId: customer.id, isActive: true } });
    if (!loc) throw new AppError(404, 'location_not_found', 'Address not found');
    if (dto.area_id) await this.assertArea(dto.area_id);
    await this.prisma.$transaction(async (tx) => {
      // There is always one default address, so a request to un-default the current one is ignored.
      if (dto.is_default === true) await tx.customerLocation.updateMany({ where: { customerId: customer.id }, data: { isDefault: false } });
      await tx.customerLocation.update({
        where: { id },
        data: {
          ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
          ...(dto.address !== undefined ? { address: dto.address.trim() } : {}),
          ...(dto.area_id ? { areaId: dto.area_id } : {}),
          ...(dto.is_default === true ? { isDefault: true } : {}),
        },
      });
    });
    return this.me(userId);
  }

  /** Addresses are switched off, not deleted, because past orders point at them. */
  async removeLocation(userId: string, id: string) {
    const customer = await this.myCustomer(userId);
    await this.prisma.$transaction(async (tx) => {
      const active = await tx.customerLocation.findMany({ where: { customerId: customer.id, isActive: true }, orderBy: { createdAt: 'asc' } });
      const loc = active.find((l) => l.id === id);
      if (!loc) throw new AppError(404, 'location_not_found', 'Address not found');
      if (active.length === 1) throw new AppError(409, 'last_location', 'Keep at least one address. Add a new one before removing this one.');
      await tx.customerLocation.update({ where: { id }, data: { isActive: false, isDefault: false } });
      if (loc.isDefault) {
        const next = active.find((l) => l.id !== id)!;
        await tx.customerLocation.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    });
    return this.me(userId);
  }

  async me(userId: string) {
    const user = await this.getUser(userId);
    const profile = await this.profile(user);
    const locations = profile.customer
      ? await this.prisma.customerLocation.findMany({
          where: { customerId: profile.customer.id, isActive: true },
          include: { area: true },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        })
      : [];
    return {
      ...profile,
      locations: locations.map((l) => ({
        id: l.id,
        label: l.label,
        address: l.address,
        area: { id: l.area.id, name: l.area.name },
        is_default: l.isDefault,
      })),
    };
  }

  async searchBusinesses(q: string) {
    const rows = await this.prisma.customer.findMany({
      where: { status: 'unclaimed', businessName: { contains: q.trim(), mode: 'insensitive' } },
      orderBy: { businessName: 'asc' },
      take: 10,
      select: { id: true, businessName: true },
    });
    return { data: rows.map((r) => ({ id: r.id, business_name: r.businessName })) };
  }

  async signup(dto: SignupDto) {
    const phone = normalizePhone(dto.phone);
    if (!phone) throw new AppError(400, 'invalid_phone', 'Enter a valid Nigerian phone number');
    if (!dto.claim_customer_id && !dto.business_name?.trim()) {
      throw new AppError(400, 'business_required', 'Choose your business from the list or enter its name');
    }
    const area = await this.prisma.area.findFirst({ where: { id: dto.area_id, isActive: true } });
    if (!area) throw new AppError(400, 'invalid_area', 'Choose a delivery area from the list');

    const passwordHash = await argon2.hash(dto.password);

    let userId: string;
    let customerStatus: string;
    try {
      ({ userId, customerStatus } = await this.prisma.$transaction(async (tx) => {
        const role = await tx.role.findUniqueOrThrow({ where: { code: 'customer' } });
        const user = await tx.user.create({
          data: {
            phone,
            email: dto.email?.trim().toLowerCase() || null,
            passwordHash,
            fullName: dto.full_name.trim(),
            mustChangePassword: false, // they chose their own password
            roles: { create: { roleId: role.id } },
          },
        });

        let customerId: string;
        if (dto.claim_customer_id) {
          // Atomic claim: only succeeds while the record is still unclaimed.
          const claimed = await tx.customer.updateMany({
            where: { id: dto.claim_customer_id, userId: null, status: 'unclaimed' },
            data: { userId: user.id, status: 'pending_approval', claimedAt: new Date() },
          });
          if (claimed.count === 0) {
            const exists = await tx.customer.findUnique({ where: { id: dto.claim_customer_id } });
            throw exists
              ? new AppError(409, 'business_already_claimed', 'This business has already been claimed. Contact Mr Nibbles for help.')
              : new AppError(404, 'business_not_found', 'We could not find that business');
          }
          customerId = dto.claim_customer_id;
        } else {
          const created = await tx.customer.create({
            data: {
              userId: user.id,
              businessName: dto.business_name!.trim(),
              status: 'pending_approval',
              source: 'signup',
              claimedAt: new Date(),
            },
          });
          customerId = created.id;
        }

        await tx.customerLocation.create({
          data: { customerId, label: 'Main', address: dto.address.trim(), areaId: area.id, isDefault: true },
        });
        await tx.auditLog.create({
          data: {
            actorUserId: user.id,
            action: 'customer.signup',
            entityType: 'customer',
            entityId: customerId,
            after: { status: 'pending_approval', claimed_existing: Boolean(dto.claim_customer_id) },
          },
        });
        return { userId: user.id, customerStatus: 'pending_approval' };
      }));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppError(409, 'phone_taken', 'An account with this phone number already exists');
      }
      throw e;
    }

    await notifyRoles(this.prisma, ['sales', 'ceo'], {
      type: 'account_update',
      title: 'New customer sign-up',
      body: `${dto.business_name?.trim() || 'A business'} is waiting for approval.`,
    }).catch(() => undefined);

    const user = await this.getUser(userId);
    return { ...(await this.issueFor(user)), user: await this.profile(user), customer_status: customerStatus };
  }

  private async getUser(id: string): Promise<UserWithRoles> {
    const user = await this.prisma.user.findUnique({ where: { id }, include: WITH_ROLES });
    if (!user || !user.isActive) throw new AppError(401, 'token_invalid', 'Please log in again');
    return user;
  }
}
