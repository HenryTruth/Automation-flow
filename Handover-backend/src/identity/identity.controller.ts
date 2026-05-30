import { Body, Controller, Post } from '@nestjs/common';
import type { RequestUser } from '../common/types/request-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { VerifyIdentityDto } from './dto/verify-identity.dto';
import { IdentityService } from './identity.service';

@Controller('me')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Post('verify-identity')
  verifyIdentity(@CurrentUser() user: RequestUser, @Body() dto: VerifyIdentityDto) {
    return this.identityService.verifyIdentity(user.id, dto.nin, dto.selfieBase64);
  }
}
