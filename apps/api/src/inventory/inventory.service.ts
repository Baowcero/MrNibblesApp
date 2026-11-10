import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import { AppError } from '../common/app-error.js';
import { isFuture, lagosDayRange, lagosToday, toDateOnly } from '../common/dates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdjustmentDto, CreateMaterialDto, DailyCountDto, LeftoverDto, ReceiptDto, RecordRunDto, UpdateMaterialDto } from './dto.js';

const D = (n: number) => new Prisma.Decimal(n);
const num = (d: Prisma.Decimal | null | undefined) => (d ? Number(d) : 0);

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------ raw materials

  /** Stock is always the sum of movements (received +, used in a run -, adjustments +/-). */
  private async stockByMaterial(until?: Date): Promise<Map<string, Prisma.Decimal>> {
    const rows = await this.prisma.rawMaterialMovement.groupBy({
      by: ['rawMaterialId'],
      where: until ? { createdAt: { lt: until } } : {},
      _sum: { quantity: true },
    });
    return new Map(rows.map((r) => [r.rawMaterialId, r._sum.quantity ?? D(0)]));
  }

  async listMaterials() {
    const [materials, stock] = await Promise.all([
      this.prisma.rawMaterial.findMany({ orderBy: { name: 'asc' } }),
      this.stockByMaterial(),
    ]);
    return {
      data: materials.map((m) => {
        const inStock = num(stock.get(m.id));
        return {
          id: m.id,
          name: m.name,
          unit: m.unit,
          in_stock: inStock,
          reorder_level: m.reorderLevel ? Number(m.reorderLevel) : null,
          below_reorder_level: m.reorderLevel ? inStock <= Number(m.reorderLevel) : false,
          is_active: m.isActive,
        };
      }),
    };
  }

  async createMaterial(actorId: string, dto: CreateMaterialDto) {
    const exists = await this.prisma.rawMaterial.findFirst({ where: { name: { equals: dto.name.trim(), mode: 'insensitive' } } });
    if (exists) throw new AppError(409, 'material_exists', 'A raw material with this name already exists');
    const m = await this.prisma.rawMaterial.create({
      data: { name: dto.name.trim().toLowerCase(), unit: dto.unit.trim(), reorderLevel: dto.reorder_level != null ? D(dto.reorder_level) : null },
    });
    await this.audit.log({ actorUserId: actorId, action: 'material.create', entityType: 'raw_material', entityId: m.id, after: { name: m.name, unit: m.unit } });
    return { id: m.id, name: m.name, unit: m.unit };
  }

  /** Units differ per material and are set here when the store keeper confirms them. */
  async updateMaterial(actorId: string, id: string, dto: UpdateMaterialDto) {
    const before = await this.prisma.rawMaterial.findUnique({ where: { id } });
    if (!before) throw new AppError(404, 'material_not_found', 'Raw material not found');
    const m = await this.prisma.rawMaterial.update({
      where: { id },
      data: {
        ...(dto.unit !== undefined ? { unit: dto.unit.trim() } : {}),
        ...(dto.reorder_level !== undefined ? { reorderLevel: D(dto.reorder_level) } : {}),
        ...(dto.is_active !== undefined ? { isActive: dto.is_active } : {}),
      },
    });
    await this.audit.log({
      actorUserId: actorId, action: 'material.update', entityType: 'raw_material', entityId: id,
      before: { unit: before.unit, reorder_level: before.reorderLevel ? Number(before.reorderLevel) : null, is_active: before.isActive },
      after: { unit: m.unit, reorder_level: m.reorderLevel ? Number(m.reorderLevel) : null, is_active: m.isActive },
    });
    return { id: m.id, unit: m.unit, reorder_level: m.reorderLevel ? Number(m.reorderLevel) : null, is_active: m.isActive };
  }

  private async assertMaterials(ids: string[]) {
    const found = await this.prisma.rawMaterial.findMany({ where: { id: { in: ids }, isActive: true } });
    if (found.length !== new Set(ids).size) throw new AppError(400, 'invalid_material', 'One of the raw materials does not exist or is switched off');
  }

  async receive(actorId: string, dto: ReceiptDto) {
    await this.assertMaterials(dto.items.map((i) => i.raw_material_id));
    await this.prisma.rawMaterialMovement.createMany({
      data: dto.items.map((i) => ({ rawMaterialId: i.raw_material_id, movementType: 'received' as const, quantity: D(i.quantity), recordedById: actorId })),
    });
    return { received: dto.items.length };
  }

  async adjust(actorId: string, dto: AdjustmentDto) {
    if (dto.quantity === 0) throw new AppError(400, 'zero_adjustment', 'The adjustment cannot be zero');
    await this.assertMaterials([dto.raw_material_id]);
    const m = await this.prisma.rawMaterialMovement.create({
      data: { rawMaterialId: dto.raw_material_id, movementType: 'adjustment', quantity: D(dto.quantity), recordedById: actorId },
    });
    await this.audit.log({ actorUserId: actorId, action: 'stock.adjust', entityType: 'raw_material', entityId: dto.raw_material_id, after: { quantity: dto.quantity, reason: dto.reason } });
    return { id: m.id };
  }

  // ------------------------------------------------------------ daily count

  /** Compares what was counted with what the movements say should be there. */
  async recordCount(actorId: string, dto: DailyCountDto) {
    const date = dto.count_date ?? lagosToday();
    if (isFuture(date)) throw new AppError(400, 'future_date', 'The count date cannot be in the future');
    await this.assertMaterials(dto.counts.map((c) => c.raw_material_id));

    const end = lagosDayRange(date).lt;
    const stock = await this.stockByMaterial(end);
    try {
      const rows = await this.prisma.$transaction(
        dto.counts.map((c) => {
          const expected = stock.get(c.raw_material_id) ?? D(0);
          const counted = D(c.counted_quantity);
          return this.prisma.dailyStockCount.create({
            data: { countDate: toDateOnly(date), rawMaterialId: c.raw_material_id, countedQuantity: counted, expectedQuantity: expected, variance: counted.minus(expected), countedById: actorId },
          });
        }),
      );
      return { date, data: rows.map((r) => ({ raw_material_id: r.rawMaterialId, counted: Number(r.countedQuantity), expected: Number(r.expectedQuantity), variance: Number(r.variance) })) };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppError(409, 'already_counted', 'Some of these materials were already counted for this date. Correct a wrong count with an adjustment.');
      }
      throw e;
    }
  }

  async counts(date?: string) {
    const d = date ?? lagosToday();
    const rows = await this.prisma.dailyStockCount.findMany({
      where: { countDate: toDateOnly(d) },
      include: { rawMaterial: true, countedBy: true },
      orderBy: { rawMaterial: { name: 'asc' } },
    });
    return {
      date: d,
      data: rows.map((r) => ({
        raw_material_id: r.rawMaterialId, name: r.rawMaterial.name, unit: r.rawMaterial.unit,
        counted: Number(r.countedQuantity), expected: Number(r.expectedQuantity), variance: Number(r.variance), counted_by: r.countedBy.fullName,
      })),
    };
  }

  // ------------------------------------------------------------ production runs

  /** One morning and one night run a day. Raw material use is recorded against the run. Runs are never edited. */
  async recordRun(actorId: string, dto: RecordRunDto) {
    const date = dto.run_date ?? lagosToday();
    if (isFuture(date)) throw new AppError(400, 'future_date', 'The run date cannot be in the future');

    const outputs = dto.outputs.filter((o) => o.quantity > 0);
    if (outputs.length === 0) throw new AppError(400, 'no_output', 'Enter how much bread the run made');
    const productIds = [...new Set(outputs.map((o) => o.product_id))];
    if (productIds.length !== outputs.length) throw new AppError(400, 'duplicate_product', 'Each bread type can appear once per run');
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds }, isActive: true } });
    if (products.length !== productIds.length) throw new AppError(400, 'invalid_product', 'One of the products does not exist');
    const materials = dto.materials ?? [];
    if (materials.length) await this.assertMaterials(materials.map((m) => m.raw_material_id));

    try {
      const run = await this.prisma.$transaction(async (tx) => {
        const created = await tx.productionRun.create({
          data: { runDate: toDateOnly(date), runType: dto.run_type, recordedById: actorId, note: dto.note },
        });
        await tx.productionRunOutput.createMany({ data: outputs.map((o) => ({ runId: created.id, productId: o.product_id, quantity: o.quantity })) });
        await tx.breadStockMovement.createMany({
          data: outputs.map((o) => ({ productId: o.product_id, movementType: 'produced' as const, quantity: o.quantity, runId: created.id, recordedById: actorId })),
        });
        if (materials.length) {
          await tx.rawMaterialMovement.createMany({
            data: materials.map((m) => ({ rawMaterialId: m.raw_material_id, movementType: 'used_in_run' as const, quantity: D(m.quantity).negated(), runId: created.id, recordedById: actorId })),
          });
        }
        return created;
      });
      return { id: run.id, run_date: date, run_type: dto.run_type };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppError(409, 'run_already_recorded', `The ${dto.run_type} run for ${date} is already recorded`);
      }
      throw e;
    }
  }

  async runs(from?: string, to?: string) {
    const end = to ?? lagosToday();
    const start = from ?? new Date(toDateOnly(end).getTime() - 6 * 86_400_000).toISOString().slice(0, 10);
    const runs = await this.prisma.productionRun.findMany({
      where: { runDate: { gte: toDateOnly(start), lte: toDateOnly(end) } },
      orderBy: [{ runDate: 'desc' }, { runType: 'asc' }],
      include: { outputs: { include: { product: true } }, materials: { include: { rawMaterial: true } }, recordedBy: true },
    });
    return {
      from: start, to: end,
      data: runs.map((r) => ({
        id: r.id, run_date: r.runDate.toISOString().slice(0, 10), run_type: r.runType, note: r.note, recorded_by: r.recordedBy.fullName,
        outputs: r.outputs.map((o) => ({ product_id: o.productId, name: o.product.name, quantity: o.quantity })),
        materials_used: r.materials.map((m) => ({ raw_material_id: m.rawMaterialId, name: m.rawMaterial.name, unit: m.rawMaterial.unit, quantity: Math.abs(Number(m.quantity)) })),
      })),
    };
  }

  // ------------------------------------------------------------ bread

  /** Bread movements for one Lagos day: made, delivered, returned and leftover (both go to the salesperson). */
  async bread(date?: string) {
    const d = date ?? lagosToday();
    const [rows, products] = await Promise.all([
      this.prisma.breadStockMovement.groupBy({ by: ['productId', 'movementType'], where: { createdAt: lagosDayRange(d) }, _sum: { quantity: true } }),
      this.prisma.product.findMany({ orderBy: { code: 'asc' } }),
    ]);
    return {
      date: d,
      data: products.map((p) => {
        const sum = (t: string) => rows.find((r) => r.productId === p.id && r.movementType === t)?._sum.quantity ?? 0;
        return { product_id: p.id, name: p.name, produced: sum('produced'), delivered: sum('delivered'), returned: sum('returned'), leftover_to_sales: sum('leftover_to_sales') };
      }),
    };
  }

  async leftover(actorId: string, dto: LeftoverDto) {
    const product = await this.prisma.product.findUnique({ where: { id: dto.product_id } });
    if (!product) throw new AppError(404, 'product_not_found', 'Product not found');
    const m = await this.prisma.breadStockMovement.create({
      data: { productId: dto.product_id, movementType: 'leftover_to_sales', quantity: dto.quantity, recordedById: actorId },
    });
    return { id: m.id };
  }
}
