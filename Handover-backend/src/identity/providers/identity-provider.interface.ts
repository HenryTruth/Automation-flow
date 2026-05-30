export interface VerificationResult {
  verified: boolean;
  legalName: string;
  selfieMatches: boolean;
}

export interface IIdentityProvider {
  verifyNinWithSelfie(nin: string, selfieBase64: string): Promise<VerificationResult>;
}

export const IDENTITY_PROVIDER = Symbol('IDENTITY_PROVIDER');
