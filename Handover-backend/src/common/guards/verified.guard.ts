import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { RequestUser } from '../types/request-user.type';

@Injectable()
export class VerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user as RequestUser;
    if (!user?.isVerified) {
      throw new ForbiddenException('Identity verification required');
    }
    return true;
  }
}
