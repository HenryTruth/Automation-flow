import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import appConfig from './config/app.config';
import cloudinaryConfig from './config/cloudinary.config';
import databaseConfig from './config/database.config';
import firebaseConfig from './config/firebase.config';
import jwtConfig from './config/jwt.config';
import paymentConfig from './config/payment.config';
import premblyConfig from './config/prembly.config';
import redisConfig from './config/redis.config';
import resendConfig from './config/resend.config';
import termiiConfig from './config/termii.config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { IdentityModule } from './identity/identity.module';
import { StorageModule } from './storage/storage.module';
import { PaymentsModule } from './payments/payments.module';
import { ListingsModule } from './listings/listings.module';
import { HandoversModule } from './handovers/handovers.module';
import { ManualModule } from './manual/manual.module';
import { DisputesModule } from './disputes/disputes.module';
import { RefundsModule } from './refunds/refunds.module';
import { InboxModule } from './inbox/inbox.module';
import { NotificationsModule } from './notifications/notifications.module';
import { JobsModule } from './jobs/jobs.module';
import { AdminModule } from './admin/admin.module';
import { GatewayModule } from './gateway/gateway.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    // Global config — one file per provider
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        jwtConfig,
        cloudinaryConfig,
        paymentConfig,
        premblyConfig,
        termiiConfig,
        firebaseConfig,
        resendConfig,
      ],
    }),

    // Rate limiting: 60 req/min per user globally; auth endpoints enforce stricter limits in-service
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),

    // Shared infrastructure (global modules)
    PrismaModule,
    RedisModule,

    // Feature modules
    AuthModule,
    UsersModule,
    IdentityModule,
    StorageModule,
    PaymentsModule,
    ListingsModule,
    HandoversModule,
    ManualModule,
    DisputesModule,
    RefundsModule,
    InboxModule,
    NotificationsModule,
    JobsModule,
    AdminModule,
    GatewayModule,
  ],
  providers: [
    // JWT guard applied globally — use @Public() decorator to opt out on public routes
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Throttle guard applied globally
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
