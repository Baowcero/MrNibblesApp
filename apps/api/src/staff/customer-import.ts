import { Body, Controller, HttpCode, Injectable, Post } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuditService } from '../audit/audit.service.js';
import { AppError } from '../common/app-error.js';
import { AuthUser, CurrentUser, Roles } from '../common/auth.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Reads CSV text: commas, "quoted, values", doubled quotes, Windows or Mac line endings, a leading BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

export const nameKey = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

const HEADERS = ['business_name', 'business name', 'business', 'customer', 'customer name', 'name'];

/** Takes the business names from the CSV: a column with a recognised header, or the first column when there is no header. */
export function extractNames(rows: string[][]): { row: number; name: string }[] {
  if (rows.length === 0) return [];
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const col = header.findIndex((h) => HEADERS.includes(h));
  const hasHeader = col >= 0;
  const idx = hasHeader ? col : 0;
  return rows.slice(hasHeader ? 1 : 0).map((r, i) => ({ row: i + (hasHeader ? 2 : 1), name: (r[idx] ?? '').trim().replace(/\s+/g, ' ') }));
}

export class ImportCustomersDto {
  @IsString() @MinLength(1) @MaxLength(200_000) csv!: string;
  /** Show what would happen without saving anything. */
  @IsOptional() @IsBoolean() dry_run?: boolean;
}

@Injectable()
export class CustomerImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** New names become "unclaimed" customers that sign up later by finding their business. Existing names are skipped. */
  async run(actorId: string, dto: ImportCustomersDto) {
    const entries = extractNames(parseCsv(dto.csv));
    if (entries.length === 0) throw new AppError(400, 'empty_file', 'The file has no business names');
    if (entries.length > 2000) throw new AppError(400, 'too_many_rows', 'Import up to 2,000 names at a time');

    const invalid: { row: number; reason: string }[] = [];
    const seen = new Set<string>();
    let duplicatesInFile = 0;
    const candidates: string[] = [];
    for (const e of entries) {
      if (e.name.length < 2) { invalid.push({ row: e.row, reason: 'empty or too short' }); continue; }
      if (e.name.length > 120) { invalid.push({ row: e.row, reason: 'longer than 120 characters' }); continue; }
      const key = nameKey(e.name);
      if (seen.has(key)) { duplicatesInFile++; continue; }
      seen.add(key);
      candidates.push(e.name);
    }

    const existing = await this.prisma.customer.findMany({ select: { businessName: true } });
    const have = new Set(existing.map((c) => nameKey(c.businessName)));
    const fresh = candidates.filter((n) => !have.has(nameKey(n)));
    const alreadyExist = candidates.filter((n) => have.has(nameKey(n)));

    if (!dto.dry_run && fresh.length) {
      await this.prisma.customer.createMany({
        data: fresh.map((businessName) => ({ businessName, status: 'unclaimed' as const, source: 'import', createdById: actorId })),
      });
      await this.audit.log({ actorUserId: actorId, action: 'customer.import', entityType: 'customer', entityId: actorId, after: { created: fresh.length } });
    }
    return {
      dry_run: !!dto.dry_run,
      rows_read: entries.length,
      [dto.dry_run ? 'would_create' : 'created']: fresh.length,
      already_exist: alreadyExist.length,
      already_exist_names: alreadyExist.slice(0, 50),
      duplicates_in_file: duplicatesInFile,
      invalid,
    };
  }
}

@Roles('sales', 'ceo')
@Controller('staff/customers')
export class CustomerImportController {
  constructor(private readonly svc: CustomerImportService) {}

  @HttpCode(200)
  @Post('import')
  run(@CurrentUser() user: AuthUser, @Body() dto: ImportCustomersDto) {
    return this.svc.run(user.id, dto);
  }
}
