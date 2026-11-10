import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser, Roles } from '../common/auth.js';
import { DateQueryDto } from '../staff/orders.dto.js';
import { AddItemDto, CloseDayDto, OpenDayDto, SettleIssueDto } from './dto.js';
import { ReconciliationService } from './reconciliation.service.js';

@Roles('sales', 'accounts', 'ceo')
@Controller('staff/reconciliation')
export class ReconciliationController {
  constructor(private readonly recon: ReconciliationService) {}

  @Get()
  view(@Query() q: DateQueryDto) {
    return this.recon.view(q.date);
  }

  @HttpCode(200)
  @Post('open')
  open(@CurrentUser() user: AuthUser, @Body() dto: OpenDayDto) {
    return this.recon.open(user.id, dto.date);
  }

  @Post(':id/items')
  addItem(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AddItemDto) {
    return this.recon.addItem(user.id, id, dto);
  }

  @HttpCode(200)
  @Post(':id/issues/:issueId/settle')
  settle(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('issueId', ParseUUIDPipe) issueId: string,
    @Body() dto: SettleIssueDto,
  ) {
    return this.recon.settleIssue(user.id, id, issueId, dto);
  }

  @HttpCode(200)
  @Post(':id/close')
  close(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CloseDayDto) {
    return this.recon.close(user.id, id, dto);
  }
}
