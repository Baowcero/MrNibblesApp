// prisma/seed.ts  (run with: npx prisma db seed)
// Loads roles, products, areas, raw materials and the 75 known customers as 'unclaimed'
// records. Customers sign up themselves with their own phone, pick their business, and staff approve.
import { PrismaClient, RoleCode } from '@prisma/client';
import argon2 from 'argon2';
import data from './seed-data.json';

const prisma = new PrismaClient();

async function main() {
  for (const code of Object.values(RoleCode)) {
    await prisma.role.upsert({ where: { code }, update: {}, create: { code } });
  }

  // One price for all customers. Replace 0 with the real price in kobo when the client confirms.
  for (const p of [
    { code: 'sliced', name: 'Sliced bread' },
    { code: 'unsliced', name: 'Unsliced bread' },
  ]) {
    await prisma.product.upsert({ where: { code: p.code }, update: {}, create: p });
  }

  for (const name of data.areas) {
    await prisma.area.upsert({ where: { name }, update: {}, create: { name } });
  }

  // Units are not confirmed yet: 'unit' is a placeholder until the store keeper confirms.
  for (const m of data.rawMaterials) {
    await prisma.rawMaterial.upsert({
      where: { name: m.name },
      update: {},
      create: { name: m.name, unit: m.unit ?? 'unit' },
    });
  }

  // Pre-loaded customers have no user yet. They claim their record at sign-up.
  for (const c of data.customers) {
    const exists = await prisma.customer.findFirst({ where: { businessName: c.businessName } });
    if (!exists) {
      await prisma.customer.create({
        data: { businessName: c.businessName, status: 'unclaimed', source: 'import' },
      });
    }
  }

  // First CEO account so someone can approve customers. Set SEED_CEO_PHONE and SEED_CEO_PASSWORD
  // in apps/api/.env (phone as +234XXXXXXXXXX). The CEO must choose a new password on first login.
  const ceoPhone = process.env.SEED_CEO_PHONE;
  const ceoPassword = process.env.SEED_CEO_PASSWORD;
  if (ceoPhone && ceoPassword) {
    const ceoRole = await prisma.role.findUniqueOrThrow({ where: { code: 'ceo' } });
    const existing = await prisma.user.findUnique({ where: { phone: ceoPhone } });
    if (!existing) {
      await prisma.user.create({
        data: {
          phone: ceoPhone,
          passwordHash: await argon2.hash(ceoPassword),
          fullName: process.env.SEED_CEO_NAME ?? 'CEO',
          mustChangePassword: true,
          roles: { create: { roleId: ceoRole.id } },
        },
      });
    }
  } else {
    console.log('SEED_CEO_PHONE / SEED_CEO_PASSWORD not set: no staff account created.');
  }

  if ((await prisma.bookingSetting.count()) === 0) {
    await prisma.bookingSetting.create({
      data: { effectiveFrom: new Date('2026-01-01T00:00:00Z') },
    });
  }
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
