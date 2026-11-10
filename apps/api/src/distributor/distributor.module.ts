import { Module } from '@nestjs/common';
import { DistributorController } from './distributor.controller.js';
import { DistributorService } from './distributor.service.js';

@Module({ controllers: [DistributorController], providers: [DistributorService] })
export class DistributorModule {}
