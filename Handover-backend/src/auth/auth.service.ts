import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { JwtPayload } from '../common/types/jwt-payload.type';

const OTP_TTL_SECONDS = 120;
const OTP_RATE_WINDOW = 600; // 10 min
const OTP_RATE_LIMIT = 3;
const OTP_ATTEMPT_LIMIT = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async requestOtp(phone: string): Promise<{ expires_in: number }> {
    // Test phone numbers: bypass rate limiting and SMS — fixed OTP stored directly.
    // Never active in production — the testPhones map is always empty there.
    const testOtp = this.getTestOtp(phone);
    if (testOtp) {
      await this.redis.set(`otp:${phone}`, testOtp, 'EX', OTP_TTL_SECONDS);
      return { expires_in: OTP_TTL_SECONDS };
    }

    const rateKey = `otp_rate:${phone}`;
    const count = await this.redis.incr(rateKey);
    if (count === 1) await this.redis.expire(rateKey, OTP_RATE_WINDOW);
    if (count > OTP_RATE_LIMIT) {
      throw new HttpException('OTP limit reached. Try again in 10 minutes.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await this.redis.set(`otp:${phone}`, otp, 'EX', OTP_TTL_SECONDS);

    // TODO: call Termii SMS API in production
    if (this.config.get('app.nodeEnv') === 'development') {
      console.log(`[DEV OTP] ${phone}: ${otp}`);
    }

    return { expires_in: OTP_TTL_SECONDS };
  }

  async verifyOtp(phone: string, otp: string): Promise<{
    access_token: string;
    refresh_token: string;
    user: User;
    is_new_user: boolean;
  }> {
    const isTestPhone = !!this.getTestOtp(phone);

    if (!isTestPhone) {
      // Rate limit OTP attempts for real phones only
      const attemptsKey = `otp_attempts:${phone}`;
      const attempts = await this.redis.incr(attemptsKey);
      if (attempts === 1) await this.redis.expire(attemptsKey, OTP_RATE_WINDOW);
      if (attempts > OTP_ATTEMPT_LIMIT) {
        throw new HttpException('Too many failed attempts. Try again in 10 minutes.', HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    const stored = await this.redis.get(`otp:${phone}`);
    if (!stored || stored !== otp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    if (!isTestPhone) {
      await this.redis.del(`otp:${phone}`, `otp_attempts:${phone}`);
    }
    // Test phones: leave the OTP in Redis so the same code works on every call
    // without needing to re-request an OTP each time.

    const existing = await this.prisma.user.findUnique({ where: { phone } });
    const isNew = !existing;

    const user = await this.prisma.user.upsert({
      where: { phone },
      create: { phone, name: '', displayName: '' },
      update: {},
    });

    const tokens = await this.issueTokens(user);
    return { ...tokens, user, is_new_user: isNew };
  }

  async refresh(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const key = `refresh:${payload.sub}:${payload.jti}`;
    const exists = await this.redis.get(key);
    if (!exists) throw new UnauthorizedException('Refresh token revoked');

    await this.redis.del(key);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
    return this.issueTokens(user);
  }

  async signOut(refreshToken: string): Promise<{ success: boolean }> {
    try {
      const payload = this.jwt.verify<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
      await this.redis.del(`refresh:${payload.sub}:${payload.jti}`);
    } catch {
      // Token already invalid — sign-out is idempotent
    }
    return { success: true };
  }

  // Returns the fixed OTP for a test phone number, or null for real phones.
  // Always returns null in production — the config layer guarantees testPhones is empty there.
  private getTestOtp(phone: string): string | null {
    const testPhones = this.config.get<Record<string, string>>('app.testPhones') ?? {};
    return testPhones[phone] ?? null;
  }

  private async issueTokens(user: User): Promise<{ access_token: string; refresh_token: string }> {
    const jti = randomUUID();
    const base: Omit<JwtPayload, 'jti'> = { sub: user.id, phone: user.phone };

    const accessSecret = this.config.get<string>('jwt.accessSecret') ?? '';
    const refreshSecret = this.config.get<string>('jwt.refreshSecret') ?? '';

    const accessToken = this.jwt.sign(
      { ...base, jti } as Record<string, unknown>,
      { secret: accessSecret, expiresIn: '15m' },
    );

    const refreshToken = this.jwt.sign(
      { ...base, jti } as Record<string, unknown>,
      { secret: refreshSecret, expiresIn: '30d' },
    );

    const refreshTtl = 30 * 24 * 60 * 60; // 30 days in seconds
    await this.redis.set(`refresh:${user.id}:${jti}`, '1', 'EX', refreshTtl);

    return { access_token: accessToken, refresh_token: refreshToken };
  }
}
