import { registerAs } from '@nestjs/config';

function parseTestPhones(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

export default registerAs('app', () => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  return {
    port: parseInt(process.env.PORT ?? '3000', 10),
    nodeEnv,
    // Test phone numbers are NEVER loaded in production — the env var is silently ignored.
    testPhones: nodeEnv === 'production' ? {} : parseTestPhones(process.env.TEST_PHONE_NUMBERS),
  };
});
