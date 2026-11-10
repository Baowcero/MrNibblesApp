import { Body, Controller, HttpCode, Injectable, Post } from '@nestjs/common';
import { Type, plainToInstance } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, ValidateNested, validate } from 'class-validator';
import { AppError } from '../common/app-error.js';
import { AuthUser, CurrentUser, Roles } from '../common/auth.js';
import { ReportIssueDto } from '../issues/dto.js';
import { IssuesService } from '../issues/issues.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConfirmDeliveryDto, FailDeliveryDto } from './dto.js';
import { DistributorService } from './distributor.service.js';

export class SyncEventDto {
  /** Made by the app when the action happens, so a retried batch never repeats an action. */
  @IsString() @MaxLength(100) client_event_id!: string;
  @IsIn(['start', 'confirm', 'fail', 'issue']) type!: 'start' | 'confirm' | 'fail' | 'issue';
  @IsUUID() delivery_id!: string;
  /** When the distributor did it on the phone (used to apply events in the right order). */
  @IsOptional() @IsDateString() occurred_at?: string;
  @IsOptional() @IsObject() payload?: Record<string, unknown>;
}

export class SyncDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => SyncEventDto) events!: SyncEventDto[];
}

type Result = { client_event_id: string; status: 'ok' | 'error'; code?: string; message?: string };

@Injectable()
export class SyncService {
  constructor(
    private readonly distributor: DistributorService,
    private readonly issues: IssuesService,
    private readonly prisma: PrismaService,
  ) {}

  private async parse<T extends object>(cls: new () => T, payload: unknown): Promise<T> {
    const inst = plainToInstance(cls, payload ?? {});
    const errors = await validate(inst, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length) throw new AppError(400, 'invalid_payload', errors.flatMap((e) => Object.values(e.constraints ?? {})).join('; '));
    return inst;
  }

  /**
   * Applies what the distributor did while offline. Every event gets its own result, so one bad event
   * never blocks the rest, and sending the same batch again is harmless: starting, confirming and failing
   * a delivery are all safe to repeat, and issues are de-duplicated by client_event_id.
   */
  async run(user: AuthUser, dto: SyncDto) {
    const seen = new Set<string>();
    const ordered = [...dto.events].sort((a, b) => (a.occurred_at ?? '').localeCompare(b.occurred_at ?? ''));
    const results: Result[] = [];

    for (const ev of ordered) {
      if (seen.has(ev.client_event_id)) {
        results.push({ client_event_id: ev.client_event_id, status: 'ok' });
        continue;
      }
      seen.add(ev.client_event_id);
      try {
        switch (ev.type) {
          case 'start':
            try {
              await this.distributor.start(user.id, ev.delivery_id);
            } catch (e) {
              // The delivery already moved past "start" (for example it was confirmed first): nothing left to do.
              if (!(e instanceof AppError && e.code === 'invalid_status_transition')) throw e;
            }
            break;
          case 'confirm':
            await this.distributor.confirm(user.id, ev.delivery_id, await this.parse(ConfirmDeliveryDto, ev.payload));
            break;
          case 'fail':
            await this.distributor.fail(user.id, ev.delivery_id, await this.parse(FailDeliveryDto, ev.payload));
            break;
          case 'issue': {
            const me = await this.distributor.me(user.id);
            const delivery = await this.prisma.delivery.findFirst({ where: { id: ev.delivery_id, distributorId: me.id } });
            if (!delivery) throw new AppError(404, 'delivery_not_found', 'Delivery not found');
            const body = await this.parse(ReportIssueDto, { ...ev.payload, client_event_id: ev.client_event_id });
            await this.issues.report(user, delivery.orderId, body);
            break;
          }
        }
        results.push({ client_event_id: ev.client_event_id, status: 'ok' });
      } catch (e) {
        const err = e instanceof AppError ? e : null;
        results.push({ client_event_id: ev.client_event_id, status: 'error', code: err?.code ?? 'server_error', message: err ? err.message : 'Something went wrong' });
      }
    }
    return { results };
  }
}

@Roles('distributor')
@Controller('distributor')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @HttpCode(200)
  @Post('sync')
  run(@CurrentUser() user: AuthUser, @Body() dto: SyncDto) {
    return this.sync.run(user, dto);
  }
}
