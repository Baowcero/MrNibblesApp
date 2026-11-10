import { Module } from '@nestjs/common';
import { CustomerPaymentsController, PaystackWebhookController, StaffPaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { PaystackClient } from './paystack.client.js';

@Module({
  controllers: [CustomerPaymentsController, StaffPaymentsController, PaystackWebhookController],
  providers: [PaymentsService, PaystackClient],
  exports: [PaymentsService],
})
export class PaymentsModule {}
