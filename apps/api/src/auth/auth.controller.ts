import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { AllowPasswordChange, AuthUser, CurrentUser, Public } from '../common/auth.js';
import { AuthService } from './auth.service.js';
import {
  BusinessSearchDto,
  ChangePasswordDto,
  LoginDto,
  RefreshDto,
  SetPasswordDto,
  SignupDto,
} from './dto.js';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @HttpCode(200)
  @Post('auth/login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
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
}
