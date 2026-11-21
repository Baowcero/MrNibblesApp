import { Controller, Get, Header, Query, StreamableFile } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { AppError } from '../common/app-error.js';
import { AuthUser, CurrentUser, Roles } from '../common/auth.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService, parsePhotoKey } from './storage.service.js';

class FileQueryDto {
  @IsString() @MaxLength(200) key!: string;
}

@Roles('ceo', 'sales', 'accounts', 'distributor')
@Controller('files')
export class FilesController {
  constructor(
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  /** Delivery photos. Staff can see all; a distributor only their own. */
  @Get()
  @Header('cache-control', 'private, max-age=3600')
  async get(@CurrentUser() user: AuthUser, @Query() q: FileQueryDto) {
    const parsed = parsePhotoKey(q.key);
    if (!parsed) throw new AppError(400, 'invalid_key', 'Invalid file key');

    if (user.roles.includes('distributor') && !user.roles.some((r) => ['ceo', 'sales', 'accounts'].includes(r))) {
      const me = await this.prisma.distributor.findUnique({ where: { userId: user.id } });
      if (me?.id !== parsed.distributorId) throw new AppError(403, 'forbidden', 'You do not have access to this');
    }
    if (!(await this.storage.exists(q.key))) throw new AppError(404, 'file_not_found', 'File not found');
    return new StreamableFile(await this.storage.read(q.key), { type: parsed.mime });
  }
}
