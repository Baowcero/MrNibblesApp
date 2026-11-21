import { Body, Controller, Delete, Get, HttpCode, Ip, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { AllowPasswordChange, AuthUser, CurrentUser, Public } from '../common/auth.js';
import { AuthService } from './auth.service.js';
import {
  BusinessSearchDto,
  ChangePasswordDto,
  LocationDto,
  LoginDto,
  RefreshDto,
  UpdateProfileDto,
  SetPasswordDto,
  SignupDto,
  UpdateLocationDto,
} from './dto.js';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @HttpCode(200)
  @Post('auth/login')
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.auth.login(dto, ip);
  }

  @Public()
  @HttpCode(200)
  @Post('auth/refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refresh_token);
  }

  @Public()
  @HttpCode(200)
  @Post('auth/logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refresh_token);
  }

  @Public()
  @Get('auth/signup/businesses')
  businesses(@Query() query: BusinessSearchDto) {
    return this.auth.searchBusinesses(query.q);
  }

  @Public()
  @Post('auth/signup')
  signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto);
  }

  @AllowPasswordChange()
  @HttpCode(200)
  @Post('auth/set-password')
  setPassword(@CurrentUser() user: AuthUser, @Body() dto: SetPasswordDto) {
    return this.auth.setPassword(user.id, dto.new_password);
  }

  @HttpCode(200)
  @Post('auth/change-password')
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.id, dto);
  }

  @AllowPasswordChange()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(user.id, dto);
  }

  @Post('me/locations')
  addLocation(@CurrentUser() user: AuthUser, @Body() dto: LocationDto) {
    return this.auth.addLocation(user.id, dto);
  }

  @Patch('me/locations/:id')
  updateLocation(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLocationDto) {
    return this.auth.updateLocation(user.id, id, dto);
  }

  @Delete('me/locations/:id')
  removeLocation(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.auth.removeLocation(user.id, id);
  }
}
