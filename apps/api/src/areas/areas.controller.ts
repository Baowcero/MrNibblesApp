import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/auth.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('areas')
export class AreasController {
  constructor(private readonly prisma: PrismaService) {}

  /** Area list for the sign-up form and the location picker. */
  @Public()
  @Get()
  async list() {
    const areas = await this.prisma.area.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return { data: areas };
  }
}
