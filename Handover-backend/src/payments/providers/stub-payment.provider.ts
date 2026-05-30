import { Injectable, Logger } from '@nestjs/common';
import {
  AccountDetails,
  IPaymentProvider,
  PaymentIntent,
  PayoutResult,
  RefundResult,
} from './payment-provider.interface';

/**
 * Stub provider used until a real payment provider is integrated.
 * All methods log their call and return mock data.
 */
@Injectable()
export class StubPaymentProvider implements IPaymentProvider {
  private readonly logger = new Logger(StubPaymentProvider.name);

  async initiatePayment(amountKobo: number, metadata: Record<string, unknown>): Promise<PaymentIntent> {
    this.logger.warn(`[STUB] initiatePayment called: ${amountKobo} kobo`, metadata);
    return { reference: `stub_ref_${Date.now()}`, authorizationUrl: 'https://example.com/pay' };
  }

  verifyWebhook(_rawBody: Buffer, _signature: string): boolean {
    this.logger.warn('[STUB] verifyWebhook called — returning true');
    return true;
  }

  async initiatePayout(accountNumber: string, bankCode: string, amountKobo: number, reference: string): Promise<PayoutResult> {
    this.logger.warn(`[STUB] initiatePayout: ${amountKobo} kobo to ${accountNumber} (${bankCode}), ref: ${reference}`);
    return { transferCode: `stub_transfer_${Date.now()}`, status: 'pending' };
  }

  async initiateRefund(paymentReference: string, amountKobo: number): Promise<RefundResult> {
    this.logger.warn(`[STUB] initiateRefund: ${amountKobo} kobo for ref ${paymentReference}`);
    return { reference: `stub_refund_${Date.now()}`, status: 'pending' };
  }

  async lookupBankAccount(bankCode: string, accountNumber: string): Promise<string> {
    this.logger.warn(`[STUB] lookupBankAccount: ${accountNumber} at bank ${bankCode}`);
    return 'STUB ACCOUNT NAME';
  }
}
