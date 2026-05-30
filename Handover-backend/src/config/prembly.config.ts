import { registerAs } from '@nestjs/config';

export default registerAs('prembly', () => ({
  apiKey: process.env.PREMBLY_API_KEY,
  appId: process.env.PREMBLY_APP_ID,
  baseUrl: process.env.PREMBLY_BASE_URL ?? 'https://api.prembly.com',
}));
