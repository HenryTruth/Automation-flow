import { Inject, Injectable } from '@nestjs/common';
import { IPaymentProvider, PAYMENT_PROVIDER, PaymentIntent, PayoutResult, RefundResult } from './providers/payment-provider.interface';

@Injectable()
export class PaymentsService {
  constructor(@Inject(PAYMENT_PROVIDER) private readonly provider: any) {}

  initiatePayment(amountKobo: number, metadata: Record<string, unknown>): Promise<PaymentIntent> {
    return this.provider.initiatePayment(amountKobo, metadata);
  }

  verifyWebhook(rawBody: Buffer, signature: string): boolean {
    return this.provider.verifyWebhook(rawBody, signature);
  }

  initiatePayout(accountNumber: string, bankCode: string, amountKobo: number, reference: string): Promise<PayoutResult> {
    return this.provider.initiatePayout(accountNumber, bankCode, amountKobo, reference);
  }

  initiateRefund(paymentReference: string, amountKobo: number): Promise<RefundResult> {
    return this.provider.initiateRefund(paymentReference, amountKobo);
  }

  lookupBankAccount(bankCode: string, accountNumber: string): Promise<string> {
    return this.provider.lookupBankAccount(bankCode, accountNumber);
  }
}
