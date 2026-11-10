import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser, Roles } from '../common/auth.js';
import { IssuesQueryDto, ReportIssueDto } from './dto.js';
import { IssuesService } from './issues.service.js';

@Controller()
export class IssuesController {
  constructor(private readonly issues: IssuesService) {}

  @Roles('customer', 'distributor', 'sales', 'accounts', 'ceo')
  @Post('orders/:id/issues')
  report(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReportIssueDto) {
    return this.issues.report(user, id, dto);
  }

  @Roles('customer')
  @Get('orders/:id/issues')
  mine(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.issues.forCustomerOrder(user.id, id);
  }

  @Roles('sales', 'accounts', 'ceo')
  @Get('staff/issues')
  list(@Query() q: IssuesQueryDto) {
    return this.issues.list(q.status);
  }
}
