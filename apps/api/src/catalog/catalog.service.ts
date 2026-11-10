import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { AppError } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type PricedProduct = { id: string; code: string; name: string; unitPriceKobo: bigint };

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Active products with the price that applies right now. One price for every customer. */
  async currentProducts(now = new Date()): Promise<PricedProduct[]> {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
      include: {
        prices: {
          where: { effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
      },
    });
    return products
      .filter((p) => p.prices.length > 0)
      .map((p) => ({ id: p.id, code: p.code, name: p.name, unitPriceKobo: p.prices[0]!.unitPriceKobo }));
  }

  async list() {
    const products = await this.currentProducts();
    return {
      data: products.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        unit_price_kobo: Number(p.unitPriceKobo),
      })),
    };
  }

  /** Ends the current price and starts a new one. Old orders keep the price they were placed at. */
  async setPrice(productId: string, unitPriceKobo: number, actorId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new AppError(404, 'product_not_found', 'Product not found');
    const now = new Date();
    const before = (await this.currentProducts(now)).find((p) => p.id === productId);

    await this.prisma.$transaction(async (tx) => {
      await tx.productPrice.updateMany({
        where: { productId, effectiveTo: null },
        data: { effectiveTo: now },
      });
      await tx.productPrice.create({
        data: { productId, unitPriceKobo: BigInt(unitPriceKobo), effectiveFrom: now },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: 'product.price_change',
          entityType: 'product',
          entityId: productId,
          before: { unit_price_kobo: before ? Number(before.unitPriceKobo) : null },
          after: { unit_price_kobo: unitPriceKobo },
        },
      });
    });
    return { id: productId, unit_price_kobo: unitPriceKobo };
  }
}
