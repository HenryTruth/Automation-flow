import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';
import { StubPaymentProvider } from './providers/stub-payment.provider';

@Module({
  providers: [
    PaymentsService,
    { provide: PAYMENT_PROVIDER, useClass: StubPaymentProvider },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
