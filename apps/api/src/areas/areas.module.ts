import { Module } from '@nestjs/common';
import { AreasController } from './areas.controller.js';

@Module({ controllers: [AreasController] })
export class AreasModule {}
