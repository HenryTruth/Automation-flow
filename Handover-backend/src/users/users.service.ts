import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationPreference, PayoutAccount, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { CreatePayoutAccountDto } from './dto/create-payout-account.dto';
import { UpdateNotificationPrefsDto } from './dto/update-notification-prefs.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  async getMe(userId: string): Promise<User & { has_payout_account: boolean }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { payoutAccount: true },
    });
    const { payoutAccount, ...rest } = user;
    return { ...rest, has_payout_account: !!payoutAccount };
  }

  async updateMe(userId: string, dto: UpdateUserDto): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      },
    });
  }

  async upsertDeviceToken(userId: string, token: string): Promise<{ success: boolean }> {
    await this.prisma.user.update({ where: { id: userId }, data: { deviceToken: token } });
    return { success: true };
  }

  async getPayoutAccount(userId: string): Promise<PayoutAccount> {
    const account = await this.prisma.payoutAccount.findUnique({ where: { userId } });
    if (!account) throw new NotFoundException('No payout account on file');
    return account;
  }

  async createPayoutAccount(userId: string, dto: CreatePayoutAccountDto): Promise<PayoutAccount> {
    // Resolve account name via payment provider (NUBAN lookup)
    const accountName = await this.payments.lookupBankAccount(dto.bankCode, dto.accountNumber);

    return this.prisma.payoutAccount.upsert({
      where: { userId },
      create: {
        userId,
        bankName: dto.bankName,
        accountNumber: dto.accountNumber,
        accountName,
        isVerified: true,
      },
      update: {
        bankName: dto.bankName,
        accountNumber: dto.accountNumber,
        accountName,
      },
    });
  }

  async getNotificationPreferences(userId: string): Promise<NotificationPreference> {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async updateNotificationPreferences(
    userId: string,
    dto: UpdateNotificationPrefsDto,
  ): Promise<NotificationPreference> {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
    });
  }
}
