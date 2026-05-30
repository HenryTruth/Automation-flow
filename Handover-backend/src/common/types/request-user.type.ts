/**
 * Minimal user shape used in controller method parameters.
 * Using a local interface avoids the TS1272 isolatedModules error
 * that occurs when Prisma types are referenced in decorator metadata.
 * Services receive the full Prisma User via PrismaService.
 */
export interface RequestUser {
  id: string;
  isAdmin: boolean;
  isBanned: boolean;
  isVerified: boolean;
  phone: string;
  displayName: string;
  deviceToken: string | null;
}
