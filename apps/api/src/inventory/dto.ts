import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DATE_PATTERN } from '../common/dates.js';

const DATE = { message: 'must look like 2026-11-16' };
const QTY = { maxDecimalPlaces: 3 };

export class RunOutputDto {
  @IsUUID() product_id!: string;
  @IsInt() @Min(0) @Max(1_000_000) quantity!: number;
}

export class RunMaterialDto {
  @IsUUID() raw_material_id!: string;
  @IsNumber(QTY) @Min(0.001) @Max(1_000_000) quantity!: number;
}

export class RecordRunDto {
  @IsOptional() @Matches(DATE_PATTERN, DATE) run_date?: string;
  @IsIn(['morning', 'night']) run_type!: 'morning' | 'night';
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => RunOutputDto) outputs!: RunOutputDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => RunMaterialDto) materials?: RunMaterialDto[];
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class RunsQueryDto {
  @IsOptional() @Matches(DATE_PATTERN, DATE) from?: string;
  @IsOptional() @Matches(DATE_PATTERN, DATE) to?: string;
}

export class CreateMaterialDto {
  @IsString() @MinLength(2) @MaxLength(60) name!: string;
  @IsString() @MinLength(1) @MaxLength(20) unit!: string;
  @IsOptional() @IsNumber(QTY) @Min(0) reorder_level?: number;
}

export class UpdateMaterialDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(20) unit?: string;
  @IsOptional() @IsNumber(QTY) @Min(0) reorder_level?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class ReceiptDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => RunMaterialDto) items!: RunMaterialDto[];
}

export class AdjustmentDto {
  @IsUUID() raw_material_id!: string;
  /** Positive adds stock, negative removes it. */
  @IsNumber(QTY) quantity!: number;
  @IsString() @MinLength(3) @MaxLength(200) reason!: string;
}

export class CountLineDto {
  @IsUUID() raw_material_id!: string;
  @IsNumber(QTY) @Min(0) counted_quantity!: number;
}

export class DailyCountDto {
  @IsOptional() @Matches(DATE_PATTERN, DATE) count_date?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => CountLineDto) counts!: CountLineDto[];
}

export class CountsQueryDto {
  @IsOptional() @Matches(DATE_PATTERN, DATE) date?: string;
}

export class LeftoverDto {
  @IsUUID() product_id!: string;
  @IsInt() @Min(1) @Max(1_000_000) quantity!: number;
}
