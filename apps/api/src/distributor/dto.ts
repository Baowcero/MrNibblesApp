import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { FailureReason } from '@prisma/client';

export class ConfirmDeliveryDto {
  /** Keys returned by POST /v1/distributor/uploads/photo. At least one photo is required. */
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(3) @IsString({ each: true }) @MaxLength(200, { each: true }) photo_keys!: string[];
  @IsOptional() @IsDateString() taken_at?: string;
  @IsOptional() @Type(() => Number) @IsLatitude() latitude?: number;
  @IsOptional() @Type(() => Number) @IsLongitude() longitude?: number;
}

export class FailDeliveryDto {
  @IsEnum(FailureReason) reason!: FailureReason;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}
