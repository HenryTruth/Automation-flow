import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertManualDto {
  @IsOptional() @IsString() @MaxLength(5000) appliances?: string;
  @IsOptional() @IsString() @MaxLength(5000) building?: string;
  @IsOptional() @IsString() @MaxLength(5000) utilities?: string;
  @IsOptional() @IsString() @MaxLength(5000) neighborhood?: string;
  // Frontend sends 'whatstays' — mapped to whatsIncluded here
  @IsOptional() @IsString() @MaxLength(5000) whatsIncluded?: string;
}
