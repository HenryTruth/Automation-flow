import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const INCOMING_REASONS = ['keys_not_handed_over', 'condition_mismatch', 'landlord_refused', 'date_changed', 'other'];
const OUTGOING_REASONS = ['keys_handed_no_confirmation', 'tenant_unresponsive', 'invalid_refund_request', 'other'];
const ALL_REASONS = [...new Set([...INCOMING_REASONS, ...OUTGOING_REASONS])];

export class CreateDisputeDto {
  @IsIn(ALL_REASONS)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;
}
