import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    const statusMap: Record<string, number> = {
      P2002: HttpStatus.CONFLICT,      // Unique constraint violation
      P2025: HttpStatus.NOT_FOUND,     // Record not found
      P2003: HttpStatus.BAD_REQUEST,   // Foreign key constraint
    };

    const messageMap: Record<string, string> = {
      P2002: 'Resource already exists',
      P2025: 'Resource not found',
      P2003: 'Invalid reference',
    };

    const status = statusMap[exception.code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const message = messageMap[exception.code] ?? 'Database error';

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception.message, exception.stack);
    }

    response.status(status).json({ statusCode: status, message });
  }
}
