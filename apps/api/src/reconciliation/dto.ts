import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { DATE_PATTERN } from '../common/dates.js';

export class OpenDayDto {
  @IsOptional() @Matches(DATE_PATTERN, { message: 'must look like 2026-11-16' }) date?: string;
}

export class AddItemDto {
  @IsIn(['return', 'payment_mismatch']) item_type!: 'return' | 'payment_mismatch';
  @IsUUID() order_id!: string;
  /** Loaves brought back (returns). */
  @IsOptional() @IsInt() @Min(1) @Max(100_000) quantity?: number;
  /** Naira amount in kobo that does not match (payment mismatches). */
  @IsOptional() @IsInt() @Min(1) amount_kobo?: number;
  @IsString() @MinLength(3) @MaxLength(300) resolution!: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class SettleIssueDto {
  @IsString() @MinLength(3) @MaxLength(300) resolution!: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class CloseDayDto {
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}
