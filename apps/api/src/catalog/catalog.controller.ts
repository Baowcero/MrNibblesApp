import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { IsInt, Max, Min } from 'class-validator';
import { AuthUser, CurrentUser, Roles } from '../common/auth.js';
import { CatalogService } from './catalog.service.js';

export class SetPriceDto {
  /** Price in kobo: ₦1,000 is 100000. */
  @IsInt() @Min(100) @Max(100_000_000) unit_price_kobo!: number;
}

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('products')
  list() {
    return this.catalog.list();
  }

  @Roles('ceo')
  @Put('staff/products/:id/price')
  setPrice(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetPriceDto, @CurrentUser() user: AuthUser) {
    return this.catalog.setPrice(id, dto.unit_price_kobo, user.id);
  }
}
