import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPrefsDto {
  @IsOptional() @IsBoolean() whatsapp?: boolean;
  @IsOptional() @IsBoolean() push?: boolean;
  @IsOptional() @IsBoolean() email?: boolean;
  @IsOptional() @IsBoolean() handoverUpdates?: boolean;
  @IsOptional() @IsBoolean() disputeAlerts?: boolean;
  @IsOptional() @IsBoolean() newMessages?: boolean;
  @IsOptional() @IsBoolean() marketing?: boolean;
}
