import { Module } from '@nestjs/common';
import { IssuesModule } from '../issues/issues.module.js';
import { DistributorController } from './distributor.controller.js';
import { DistributorService } from './distributor.service.js';
import { SyncController, SyncService } from './sync.js';

@Module({
  imports: [IssuesModule],
  controllers: [DistributorController, SyncController],
  providers: [DistributorService, SyncService],
})
export class DistributorModule {}
