import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class ReportIssueDto {
  @IsIn(['missing', 'damaged', 'wrong_quantity', 'other']) issue_type!: 'missing' | 'damaged' | 'wrong_quantity' | 'other';
  /** How many loaves are affected. Needed for missing, damaged and wrong_quantity. */
  @IsOptional() @IsInt() @Min(1) @Max(100_000) quantity?: number;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(500) note?: string;
  /** Photo keys from POST /distributor/uploads/photo. Only distributors can attach photos for now. */
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true }) photo_keys?: string[];
  /** Set by the app so a retry after a bad network does not create a second issue. */
  @IsOptional() @IsString() @MaxLength(100) client_event_id?: string;
}

export class IssuesQueryDto {
  @IsOptional() @IsIn(['open', 'settled']) status?: 'open' | 'settled';
}
