import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    this.client = new Redis(
      configService.get<string>('redis.url') ?? 'redis://localhost:6379',
      { lazyConnect: true },
    );
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  set(key: string, value: string, mode: 'EX', seconds: number): Promise<'OK' | null> {
    return this.client.set(key, value, mode, seconds);
  }

  setNx(key: string, value: string): Promise<number> {
    return this.client.setnx(key, value);
  }

  del(...keys: string[]): Promise<number> {
    return this.client.del(...keys);
  }

  incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  setWithoutExpiry(key: string, value: string): Promise<'OK'> {
    return this.client.set(key, value);
  }
}
