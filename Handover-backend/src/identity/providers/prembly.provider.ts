import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { IIdentityProvider, VerificationResult } from './identity-provider.interface';

@Injectable()
export class PremblyProvider implements IIdentityProvider {
  private readonly logger = new Logger(PremblyProvider.name);

  constructor(private readonly config: ConfigService) {}

  async verifyNinWithSelfie(nin: string, selfieBase64: string): Promise<VerificationResult> {
    const apiKey = this.config.get<string>('prembly.apiKey');
    const appId = this.config.get<string>('prembly.appId');
    const baseUrl = this.config.get<string>('prembly.baseUrl');

    const response = await axios.post(
      `${baseUrl}/api/v2/biometrics/merchant/data/verification/nin/face`,
      { nin, image: selfieBase64 },
      {
        headers: {
          'x-api-key': apiKey,
          'app-id': appId,
          'Content-Type': 'application/json',
        },
      },
    );

    const { status, data } = response.data;
    if (!status) {
      this.logger.warn(`Prembly NIN verification failed for NIN ending ...${nin.slice(-4)}`);
      return { verified: false, legalName: '', selfieMatches: false };
    }

    const fullName = [data?.firstname, data?.middlename, data?.lastname]
      .filter(Boolean)
      .join(' ');

    return {
      verified: true,
      legalName: fullName,
      selfieMatches: data?.face_data?.faceMatch ?? false,
    };
  }
}
