import { registerAs } from '@nestjs/config';

// Payment provider is TBD — this config will be populated when a provider is chosen.
export default registerAs('payment', () => ({
  providerApiKey: process.env.PAYMENT_PROVIDER_API_KEY,
  webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET,
}));
