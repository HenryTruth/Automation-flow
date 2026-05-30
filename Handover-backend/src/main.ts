import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { RolesGuard } from './common/guards/roles.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Expose raw body for payment webhook signature verification
    rawBody: true,
  });

  const config = app.get(ConfigService);
  const reflector = app.get(Reflector);

  // Global validation — strip unknown fields, reject invalid ones
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global Prisma error → HTTP error mapping
  app.useGlobalFilters(new PrismaExceptionFilter());

  // Wrap all responses in { data: ... }
  app.useGlobalInterceptors(new TransformInterceptor());

  // Admin role guard
  app.useGlobalGuards(new RolesGuard(reflector));

  const port = config.get<number>('app.port') ?? 3000;
  await app.listen(port);
  console.log(`Handover API running on port ${port}`);
}

bootstrap();
