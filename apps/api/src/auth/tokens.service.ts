import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { SignJWT } from 'jose';
import type { RoleCode } from '@prisma/client';
import { ACCESS_TTL_SECONDS, REFRESH_TTL_DAYS, accessSecret } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type TokenSubject = { id: string; roles: RoleCode[]; mustChangePassword: boolean };

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class TokensService {
  constructor(private readonly prisma: PrismaService) {}

  /** Issues a 15 minute access token and a rotating 30 day refresh token (only its hash is stored). */
  async issue(subject: TokenSubject) {
    const accessToken = await new SignJWT({ roles: subject.roles, mcp: subject.mustChangePassword })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(subject.id)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
      .sign(accessSecret());

    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId: subject.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000),
      },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer' as const,
      expires_in: ACCESS_TTL_SECONDS,
    };
  }

  revokeAllForUser(userId: string) {
    return this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}
