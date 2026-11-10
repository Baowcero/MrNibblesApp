import { Module } from '@nestjs/common';
import { CustomerPaymentsController, PaystackWebhookController, StaffPaymentsController } from './payments.controller.js';
import { PaymentMethodController, PaymentMethodService } from './payment-method.js';
import { PaymentsService } from './payments.service.js';
import { PaystackClient } from './paystack.client.js';

@Module({
  controllers: [PaymentMethodController, CustomerPaymentsController, StaffPaymentsController, PaystackWebhookController],
  providers: [PaymentMethodService, PaymentsService, PaystackClient],
  exports: [PaymentsService],
})
export class PaymentsModule {}
