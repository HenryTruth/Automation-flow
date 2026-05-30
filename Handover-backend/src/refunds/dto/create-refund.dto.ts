import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const REFUND_REASONS = [
  'landlord_did_not_confirm',
  'condition_mismatch',
  'date_changed',
  'keys_not_received',
  'found_other',
  'other',
];

export class CreateRefundDto {
  @IsIn(REFUND_REASONS)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;

  @IsOptional()
  @IsBoolean()
  withdrawDispute?: boolean;
}
