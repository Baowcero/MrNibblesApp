import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;
const PASSWORD_MESSAGE = 'Password must be at least 8 characters and include a letter and a number';

export class LoginDto {
  @IsString() @MaxLength(20) phone!: string;
  @IsString() @MinLength(1) @MaxLength(128) password!: string;
}

export class RefreshDto {
  @IsString() @MinLength(10) @MaxLength(200) refresh_token!: string;
}

export class SetPasswordDto {
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE }) new_password!: string;
}

export class ChangePasswordDto {
  @IsString() @MaxLength(128) current_password!: string;
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE }) new_password!: string;
}

export class SignupDto {
  @IsString() @MaxLength(20) phone!: string;
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE }) password!: string;
  @IsString() @MinLength(2) @MaxLength(100) full_name!: string;
  /** Pick a pre-loaded business, or leave empty and send business_name for a new one. */
  @IsOptional() @IsUUID() claim_customer_id?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) business_name?: string;
  @IsString() @MinLength(5) @MaxLength(255) address!: string;
  @IsUUID() area_id!: string;
}

export class BusinessSearchDto {
  @IsString() @MinLength(2) @MaxLength(60) q!: string;
}
