import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { AuthUser, CurrentUser, Roles } from '../common/auth.js';
import { DateQueryDto } from '../staff/orders.dto.js';
import {
  AdjustmentDto, CountsQueryDto, CreateMaterialDto, DailyCountDto, LeftoverDto, ReceiptDto, RecordRunDto, RunsQueryDto, UpdateMaterialDto,
} from './dto.js';
import { InventoryService } from './inventory.service.js';

@Controller('staff')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  // ---- production runs
  @Roles('production', 'ceo')
  @Post('production/runs')
  recordRun(@CurrentUser() user: AuthUser, @Body() dto: RecordRunDto) {
    return this.inventory.recordRun(user.id, dto);
  }

  @Roles('production', 'ceo', 'sales', 'store_keeper')
  @Get('production/runs')
  runs(@Query() q: RunsQueryDto) {
    return this.inventory.runs(q.from, q.to);
  }

  // ---- raw materials
  @Roles('store_keeper', 'production', 'ceo')
  @Get('inventory/materials')
  materials() {
    return this.inventory.listMaterials();
  }

  @Roles('store_keeper', 'ceo')
  @Post('inventory/materials')
  createMaterial(@CurrentUser() user: AuthUser, @Body() dto: CreateMaterialDto) {
    return this.inventory.createMaterial(user.id, dto);
  }

  @Roles('store_keeper', 'ceo')
  @Put('inventory/materials/:id')
  updateMaterial(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMaterialDto) {
    return this.inventory.updateMaterial(user.id, id, dto);
  }

  @Roles('store_keeper', 'ceo')
  @HttpCode(200)
  @Post('inventory/receipts')
  receive(@CurrentUser() user: AuthUser, @Body() dto: ReceiptDto) {
    return this.inventory.receive(user.id, dto);
  }

  @Roles('store_keeper', 'ceo')
  @Post('inventory/adjustments')
  adjust(@CurrentUser() user: AuthUser, @Body() dto: AdjustmentDto) {
    return this.inventory.adjust(user.id, dto);
  }

  // ---- daily count
  @Roles('store_keeper', 'ceo')
  @Post('inventory/counts')
  recordCount(@CurrentUser() user: AuthUser, @Body() dto: DailyCountDto) {
    return this.inventory.recordCount(user.id, dto);
  }

  @Roles('store_keeper', 'production', 'ceo')
  @Get('inventory/counts')
  counts(@Query() q: CountsQueryDto) {
    return this.inventory.counts(q.date);
  }

  // ---- bread
  @Roles('production', 'sales', 'store_keeper', 'ceo', 'accounts')
  @Get('inventory/bread')
  bread(@Query() q: DateQueryDto) {
    return this.inventory.bread(q.date);
  }

  @Roles('production', 'sales', 'ceo')
  @Post('inventory/bread/leftover')
  leftover(@CurrentUser() user: AuthUser, @Body() dto: LeftoverDto) {
    return this.inventory.leftover(user.id, dto);
  }
}
