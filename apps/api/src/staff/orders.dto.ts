import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Fulfilment, OrderStatus } from '@prisma/client';
import { DATE_PATTERN } from '../common/dates.js';

export class StaffOrdersQueryDto {
  /** Delivery date, YYYY-MM-DD. Defaults to today (Lagos). */
  @IsOptional() @Matches(DATE_PATTERN, { message: 'date must look like 2026-11-16' }) date?: string;
  @IsOptional() @IsEnum(OrderStatus) status?: OrderStatus;
  @IsOptional() @IsEnum(Fulfilment) fulfilment?: Fulfilment;
  @IsOptional() @IsUUID() area_id?: string;
  @IsOptional() @IsString() @MaxLength(60) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
  @IsOptional() @IsUUID() cursor?: string;
}

export class DateQueryDto {
  @IsOptional() @Matches(DATE_PATTERN, { message: 'date must look like 2026-11-16' }) date?: string;
}

export class AssignOrdersDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @IsUUID(undefined, { each: true }) order_ids!: string[];
  @IsUUID() distributor_id!: string;
}

export class ReassignDto {
  @IsUUID() distributor_id!: string;
}
