import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AreasModule } from './areas/areas.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ErrorEnvelopeFilter } from './common/error-envelope.filter.js';
import { JwtAuthGuard } from './common/jwt-auth.guard.js';
import { RolesGuard } from './common/roles.guard.js';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { StaffCustomersModule } from './staff/customers.module.js';

@Module({
  imports: [PrismaModule, AuditModule, AuthModule, AreasModule, StaffCustomersModule],
  controllers: [HealthController],
  providers: [
    // Order matters: log in first, then check the role.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: ErrorEnvelopeFilter },
  ],
})
export class AppModule {}
