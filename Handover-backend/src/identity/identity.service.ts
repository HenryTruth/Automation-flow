import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { encryptNin } from '../common/utils/crypto.util';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  IDENTITY_PROVIDER,
  IIdentityProvider,
} from './providers/identity-provider.interface';

@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @Inject(IDENTITY_PROVIDER) private readonly provider: any,
  ) {}

  async verifyIdentity(
    userId: string,
    nin: string,
    selfieBase64: string,
  ): Promise<{ verified: boolean; nin_name: string }> {
    const result = await this.provider.verifyNinWithSelfie(nin, selfieBase64);

    if (!result.verified || !result.selfieMatches) {
      throw new BadRequestException('Identity verification failed');
    }

    // Upload selfie to Cloudinary
    const selfieBuffer = Buffer.from(selfieBase64, 'base64');
    const selfieUrl = await this.storage.uploadBuffer(selfieBuffer, `selfies/${userId}`, 'image/jpeg');

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        nin: encryptNin(nin),
        selfieUrl,
        name: result.legalName,
        displayName: result.legalName,
        isVerified: true,
      },
    });

    return { verified: true, nin_name: result.legalName };
  }
}
