import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderItemDto {
  @IsUUID() product_id!: string;
  @IsInt() @Min(1) @Max(100_000) quantity!: number;
}

export class QuoteDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  /** Paystack adds a fee line; paying cash at the office does not. */
  @IsIn(['paystack', 'office_cash']) payment_method!: 'paystack' | 'office_cash';
}

export class CreateOrderDto extends QuoteDto {
  @IsIn(['delivery', 'pickup']) fulfilment!: 'delivery' | 'pickup';
  /** Required for delivery. Must be one of the customer's own locations. */
  @IsOptional() @IsUUID() location_id?: string;
}

export class ListOrdersDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
  @IsOptional() @IsUUID() cursor?: string;
}
