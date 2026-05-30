import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import type { RequestUser } from '../common/types/request-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreatePayoutAccountDto } from './dto/create-payout-account.dto';
import { DeviceTokenDto } from './dto/device-token.dto';
import { UpdateNotificationPrefsDto } from './dto/update-notification-prefs.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('me')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getMe(@CurrentUser() user: RequestUser) {
    return this.usersService.getMe(user.id);
  }

  @Patch()
  updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateUserDto) {
    return this.usersService.updateMe(user.id, dto);
  }

  @Post('device-token')
  @HttpCode(HttpStatus.OK)
  upsertDeviceToken(@CurrentUser() user: RequestUser, @Body() dto: DeviceTokenDto) {
    return this.usersService.upsertDeviceToken(user.id, dto.token);
  }

  @Get('payout-account')
  getPayoutAccount(@CurrentUser() user: RequestUser) {
    return this.usersService.getPayoutAccount(user.id);
  }

  @Post('payout-account')
  createPayoutAccount(@CurrentUser() user: RequestUser, @Body() dto: CreatePayoutAccountDto) {
    return this.usersService.createPayoutAccount(user.id, dto);
  }

  @Get('notification-preferences')
  getNotificationPreferences(@CurrentUser() user: RequestUser) {
    return this.usersService.getNotificationPreferences(user.id);
  }

  @Patch('notification-preferences')
  updateNotificationPreferences(@CurrentUser() user: RequestUser, @Body() dto: UpdateNotificationPrefsDto) {
    return this.usersService.updateNotificationPreferences(user.id, dto);
  }
}
