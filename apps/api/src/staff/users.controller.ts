import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import { ArrayMinSize, IsArray, IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, Roles } from '../common/auth.js';
import { StaffUsersService } from './users.service.js';

const STAFF_ROLES = ['distributor', 'ceo', 'sales', 'accounts', 'production', 'store_keeper'] as const;

export class CreateStaffUserDto {
  @IsString() @MinLength(2) @MaxLength(100) full_name!: string;
  @IsString() @MaxLength(20) phone!: string;
  @IsArray() @ArrayMinSize(1) @IsIn(STAFF_ROLES, { each: true }) roles!: RoleCode[];
}

export class ListUsersDto {
  @IsOptional() @IsEnum(RoleCode) role?: RoleCode;
}

@Controller('staff')
export class StaffUsersController {
  constructor(private readonly users: StaffUsersService) {}

  @Roles('ceo')
  @Post('users')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStaffUserDto) {
    return this.users.create(user.id, { fullName: dto.full_name, phone: dto.phone, roles: dto.roles });
  }

  @Roles('ceo')
  @Get('users')
  list(@Query() q: ListUsersDto) {
    return this.users.list(q.role);
  }

  @Roles('ceo')
  @HttpCode(200)
  @Post('users/:id/reset-password')
  reset(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.resetPassword(user.id, id);
  }

  @Roles('ceo')
  @HttpCode(200)
  @Post('users/:id/deactivate')
  deactivate(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.setActive(user.id, id, false);
  }

  @Roles('ceo')
  @HttpCode(200)
  @Post('users/:id/activate')
  activate(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.setActive(user.id, id, true);
  }

  @Roles('ceo', 'sales')
  @Get('distributors')
  distributors() {
    return this.users.distributors();
  }
}
