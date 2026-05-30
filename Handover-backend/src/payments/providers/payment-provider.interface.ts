export interface PaymentIntent {
  reference: string;
  authorizationUrl?: string;
  accessCode?: string;
}

export interface PayoutResult {
  transferCode: string;
  status: string;
}

export interface RefundResult {
  reference: string;
  status: string;
}

export interface AccountDetails {
  accountName: string;
}

export interface IPaymentProvider {
  initiatePayment(amountKobo: number, metadata: Record<string, unknown>): Promise<PaymentIntent>;
  verifyWebhook(rawBody: Buffer, signature: string): boolean;
  initiatePayout(accountNumber: string, bankCode: string, amountKobo: number, reference: string): Promise<PayoutResult>;
  initiateRefund(paymentReference: string, amountKobo: number): Promise<RefundResult>;
  lookupBankAccount(bankCode: string, accountNumber: string): Promise<string>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
